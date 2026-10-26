package com.saharacleaning.oshelper

import org.json.JSONObject
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** Plain HttpURLConnection calls to Sahara OS. HTTPS only (the manifest forbids cleartext). */
object Api {
    data class Result(val code: Int, val body: String)

    fun postJson(url: String, token: String, json: JSONObject): Result {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 15_000
            c.readTimeout = 30_000
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.setRequestProperty("Authorization", "Bearer $token")
            c.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
            return read(c)
        } finally {
            c.disconnect()
        }
    }

    /** multipart/form-data with text fields and (optionally) one audio file, streamed — a 30 MB recording is never held in memory. */
    fun postMultipart(url: String, token: String, fields: Map<String, String>, file: FilePart?): Result {
        val boundary = "----saharaos" + UUID.randomUUID().toString().replace("-", "")
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 15_000
            c.readTimeout = 120_000
            c.doOutput = true
            c.setChunkedStreamingMode(64 * 1024)
            c.setRequestProperty("Authorization", "Bearer $token")
            c.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            c.outputStream.use { out ->
                val crlf = "\r\n"
                for ((k, v) in fields) {
                    out.write("--$boundary$crlf".toByteArray())
                    out.write("Content-Disposition: form-data; name=\"$k\"$crlf$crlf".toByteArray())
                    out.write(v.toByteArray(Charsets.UTF_8))
                    out.write(crlf.toByteArray())
                }
                if (file != null) {
                    out.write("--$boundary$crlf".toByteArray())
                    out.write("Content-Disposition: form-data; name=\"file\"; filename=\"${file.name}\"$crlf".toByteArray())
                    out.write("Content-Type: ${file.mime}$crlf$crlf".toByteArray())
                    file.stream.use { it.copyTo(out, 64 * 1024) }
                    out.write(crlf.toByteArray())
                }
                out.write("--$boundary--$crlf".toByteArray())
            }
            return read(c)
        } finally {
            c.disconnect()
        }
    }

    class FilePart(val name: String, val mime: String, val stream: InputStream)

    private fun read(c: HttpURLConnection): Result {
        val code = c.responseCode
        val stream = if (code in 200..299) c.inputStream else c.errorStream
        val body = try { stream?.bufferedReader()?.use { it.readText() } ?: "" } catch (e: Exception) { "" }
        return Result(code, body)
    }
}
