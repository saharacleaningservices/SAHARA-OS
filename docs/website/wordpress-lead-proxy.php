<?php
/**
 * Plugin Name: Sahara Lead Proxy
 * Description: Server-side proxy from the WordPress site to Sahara OS  POST /api/public/v1/leads.
 *              The API token and HMAC secret live ONLY in wp-config.php (PHP), never in page HTML or JavaScript.
 * Version: 1.0
 *
 * INSTALL (either way works; mu-plugin is safest because a theme update cannot remove it):
 *   A) cPanel/File Manager: upload this file to  wp-content/mu-plugins/sahara-lead-proxy.php
 *   B) "Code Snippets" plugin: paste everything below this comment block (without the opening php tag) as a PHP snippet, run everywhere.
 *
 * wp-config.php (above the line "That's all, stop editing!") - values from Coolify, same as PUBLIC_API_TOKEN / PUBLIC_API_HMAC_SECRET:
 *   define('SAHARA_API_BASE',        'https://crm.saharacleaningservices.com');   // no trailing slash
 *   define('SAHARA_API_TOKEN',       '...');
 *   define('SAHARA_API_HMAC_SECRET', '...');
 *   // define('SAHARA_TRUST_CF_IP', true);   // only once the site is behind Cloudflare: use CF-Connecting-IP as the visitor IP
 *
 * Front-end form (plain JS, no secrets):
 *   fetch('/wp-json/sahara/v1/lead', {method:'POST', headers:{'Content-Type':'application/json'},
 *         body: JSON.stringify({form_type:'b2c', name:'...', mobile:'...', serviceCategory:'HOME_DEEP_CLEANING', area:'Kharadi', website:''})})
 *   `website` is the hidden honeypot field: leave it empty.
 *
 * form_type -> CRM lead tag:  b2c -> B2C_BOOKING | b2b -> B2B_COMMERCIAL_INSPECTION | property -> PROPERTY_SOLUTIONS
 */
if (!defined('ABSPATH')) { exit; }

const SAHARA_LEAD_TAGS = array(
    'b2c'      => 'B2C_BOOKING',
    'b2b'      => 'B2B_COMMERCIAL_INSPECTION',
    'property' => 'PROPERTY_SOLUTIONS',
);

// Only these fields are forwarded (anything else a visitor sends is dropped). Mirrors docs/website/public-api-v1.openapi.yaml.
const SAHARA_LEAD_FIELDS = array(
    'name', 'mobile', 'alternateMobile', 'email', 'area', 'address', 'pinCode', 'serviceCategory', 'serviceVariant',
    'propertyType', 'packageName', 'serviceDate', 'timeSlot', 'notes', 'mapLink', 'source', 'referralCode',
    'paymentPreference', 'marketingOptIn', 'website', 'attribution',
);

function sahara_visitor_ip() {
    if (defined('SAHARA_TRUST_CF_IP') && SAHARA_TRUST_CF_IP && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = trim($_SERVER['HTTP_CF_CONNECTING_IP']);
    } else {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

/** Signs and sends one lead. Returns array(http_status, decoded_body). Secrets never leave this function. */
function sahara_forward_lead(array $fields, $form_type, $idempotency_key) {
    if (!defined('SAHARA_API_BASE') || !defined('SAHARA_API_TOKEN') || !defined('SAHARA_API_HMAC_SECRET')) {
        return array(503, array('error' => 'Lead service is not configured.'));
    }
    if (!isset(SAHARA_LEAD_TAGS[$form_type])) {
        return array(400, array('error' => 'Unknown form type.'));
    }
    $ip = sahara_visitor_ip();
    if ($ip === '') {
        return array(400, array('error' => 'Could not determine visitor address.'));
    }
    $payload = array_intersect_key($fields, array_flip(SAHARA_LEAD_FIELDS));
    $payload['leadTag'] = SAHARA_LEAD_TAGS[$form_type];
    $payload['client']  = array('ip' => $ip);
    $raw = wp_json_encode($payload);
    $ts  = (string) time();
    $sig = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, SAHARA_API_HMAC_SECRET);

    $res = wp_remote_post(rtrim(SAHARA_API_BASE, '/') . '/api/public/v1/leads', array(
        'timeout' => 12,
        'headers' => array(
            'Content-Type'        => 'application/json',
            'Authorization'       => 'Bearer ' . SAHARA_API_TOKEN,
            'X-Sahara-Timestamp'  => $ts,
            'X-Sahara-Signature'  => $sig,
            'Idempotency-Key'     => $idempotency_key,
        ),
        'body'    => $raw,
    ));
    if (is_wp_error($res)) {
        error_log('[sahara-lead-proxy] transport error: ' . $res->get_error_message());
        return array(503, array('error' => 'Temporarily unavailable. Please call or WhatsApp us to book.'));
    }
    $status = (int) wp_remote_retrieve_response_code($res);
    $body   = json_decode(wp_remote_retrieve_body($res), true);
    if ($status === 401 || $status === 404) { // misconfigured secrets: log for the owner, show visitors nothing technical
        error_log('[sahara-lead-proxy] CRM rejected credentials/route (HTTP ' . $status . ').');
        return array(503, array('error' => 'Temporarily unavailable. Please call or WhatsApp us to book.'));
    }
    return array($status, is_array($body) ? $body : array('error' => 'Unexpected response.'));
}

add_action('rest_api_init', function () {
    register_rest_route('sahara/v1', '/lead', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true', // public form endpoint; protected by honeypot, per-IP throttle and server-side validation in the CRM
        'callback'            => function (WP_REST_Request $request) {
            $in = $request->get_json_params();
            if (!is_array($in)) {
                return new WP_REST_Response(array('error' => 'Invalid request.'), 400);
            }
            // Cheap per-IP throttle on this server (the CRM throttles per visitor again): 5 submissions / 10 minutes.
            $ip  = sahara_visitor_ip();
            $key = 'sahara_lead_' . md5($ip);
            $cnt = (int) get_transient($key);
            if ($cnt >= 5) {
                return new WP_REST_Response(array('error' => 'Too many requests. Please try again shortly.'), 429);
            }
            set_transient($key, $cnt + 1, 10 * MINUTE_IN_SECONDS);

            $form_type = isset($in['form_type']) ? sanitize_key($in['form_type']) : 'b2c';
            // Stable per submission payload, so a double-tap/retry reuses the CRM's idempotent replay.
            $idem = 'wp-' . substr(hash('sha256', wp_json_encode($in) . gmdate('YmdH')), 0, 40);
            list($status, $body) = sahara_forward_lead($in, $form_type, $idem);
            return new WP_REST_Response($body, $status);
        },
    ));
});
