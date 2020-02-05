#ifndef TASK_MQTT_AWS
#define TASK_MQTT_AWS

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include "../config/config.h"

extern short measureIndex;
extern short measurements[];

WiFiClientSecure AWS_net;
MQTTClient AWS_mqtt = MQTTClient(512);

extern const uint8_t aws_root_ca_pem_start[] asm("_binary_certificates_amazonrootca1_pem_start");
extern const uint8_t aws_root_ca_pem_end[] asm("_binary_certificates_amazonrootca1_pem_end");

extern const uint8_t certificate_pem_crt_start[] asm("_binary_certificates_certificate_pem_crt_start");
extern const uint8_t certificate_pem_crt_end[] asm("_binary_certificates_certificate_pem_crt_end");

extern const uint8_t private_pem_key_start[] asm("_binary_certificates_private_pem_key_start");
extern const uint8_t private_pem_key_end[] asm("_binary_certificates_private_pem_key_end");

void keepAWSConnectionAlive(void * parameter){
    for(;;){
        if(AWS_mqtt.connected()){
            AWS_mqtt.loop();
            vTaskDelay(500 / portTICK_PERIOD_MS);
            continue;
        }

        if(!WiFi.isConnected()){
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            continue;
        }

        // Configure certificates
        AWS_net.setCACert((const char *) aws_root_ca_pem_start);
        AWS_net.setCertificate((const char *) certificate_pem_crt_start);
        AWS_net.setPrivateKey((const char *) private_pem_key_start);

        Serial.println("[MQTT] Connecting to AWS...");
        AWS_mqtt.begin(AWS_IOT_ENDPOINT, 8883, AWS_net);

        long startAttemptTime = millis();
    
        while (!AWS_mqtt.connect(DEVICE_NAME, HA_USER, HA_PASSWORD) &&
                millis() - startAttemptTime < MQTT_CONNECT_TIMEOUT)
        {
            vTaskDelay(MQTT_CONNECT_DELAY);
        }

        if(!AWS_mqtt.connected()){
            Serial.println("[MQTT] AWS connection timeout. Retry in 30s.");
            vTaskDelay(30000 / portTICK_PERIOD_MS);
        }

        Serial.println("[MQTT] AWS Connected!");
    }
}

/**
 * TASK: Upload measurements to AWS. This only works when there are enough
 * local measurements. It's called by the measurement function.
 */
void uploadMeasurementsToAWS(void * parameter){
    if(!WiFi.isConnected() || !AWS_mqtt.connected()){
        Serial.println("[MQTT] AWS: no connection. Discarding data..");
        measureIndex = 0;
        vTaskDelete(NULL);
    }

    if (measureIndex == LOCAL_MEASUREMENTS){
        String msg = "{\"readings\": [";

        for (short i = 0; i < LOCAL_MEASUREMENTS-1; i++){
            msg += measurements[i];
            msg += ",";
        }

        msg += measurements[LOCAL_MEASUREMENTS-1];
        msg += "]}";
    
        Serial.println("[MQTT] AWS publish: " + msg);
        AWS_mqtt.publish(AWS_IOT_TOPIC, msg);

        measureIndex = 0;
    }

    // Task is done!
    vTaskDelete(NULL);
}
#endif
