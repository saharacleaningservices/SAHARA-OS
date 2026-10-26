plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Sahara OS Helper — no third-party libraries on purpose (framework APIs only): nothing to audit, nothing to break the build.
android {
    namespace = "com.saharacleaning.oshelper"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.saharacleaning.oshelper"
        minSdk = 29 // Android 10+: MediaStore RELATIVE_PATH (call-recording folders)
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
