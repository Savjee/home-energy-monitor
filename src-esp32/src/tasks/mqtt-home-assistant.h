#ifndef TASK_HOME_ASSISTANT
#define TASK_HOME_ASSISTANT

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <MQTTClient.h>
#include "../config/config.h"

WiFiClientSecure HA_net;
MQTTClient HA_mqtt(1024);

extern unsigned short measurements[];

const char* PROGMEM HA_discovery_msg = "{"
        "\"name\":\"" DEVICE_NAME "\","
        "\"device_class\":\"power\","
        "\"unit_of_measurement\":\"W\","
        "\"icon\":\"mdi:transmission-tower\","
        "\"state_topic\":\"homeassistant/sensor/" DEVICE_NAME "/state\","
        "\"value_template\":\"{{ value_json.power}}\","
        "\"device\": {"
            "\"name\":\"" DEVICE_NAME "\","
            "\"sw_version\":\"2.0\","
            "\"model\":\"HW V2\","
            "\"manufacturer\":\"Xavier Decuyper\","
            "\"identifiers\":[\"" DEVICE_NAME "\"]"
        "}"
    "}";

/**
 * Established a connection to Home Assistant MQTT broker.
 * 
 * This task should run continously. It will check if an
 * MQTT connection is active and if so, will sleep for 1
 * minute. If not, a new connection will be established.
 */
void keepHAConnectionAlive(void * parameter){
    for(;;){
        // When we are connected, loop the MQTT client and sleep for 0,5s
        if(HA_mqtt.connected()){
            HA_mqtt.loop();
            vTaskDelay(250 / portTICK_PERIOD_MS);
            continue;
        }

        if(!WiFi.isConnected()){
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            continue;
        }

        serial_println(F("[MQTT] Connecting to HA..."));
        HA_mqtt.begin(HA_ADDRESS, HA_PORT, HA_net);

        long startAttemptTime = millis();
    
        while (!HA_mqtt.connect(DEVICE_NAME, HA_USER, HA_PASSWORD) &&
                millis() - startAttemptTime < MQTT_CONNECT_TIMEOUT)
        {
            vTaskDelay(MQTT_CONNECT_DELAY / portTICK_PERIOD_MS);
        }

        if(!HA_mqtt.connected()){
            serial_println(F("[MQTT] HA connection failed. Waiting 30s.."));
            vTaskDelay(30000 / portTICK_PERIOD_MS);
        }

        serial_println(F("[MQTT] HA Connected!"));
    }
}

/**
 * TASK: Every 15 minutes we send Home Assistant a discovery message
 *       so that the energy monitor shows up in the device registry.
 */
void HADiscovery(void * parameter){
    for(;;){
        if(!HA_mqtt.connected()){
            serial_println(F("[MQTT] HA: no MQTT connection."));
            vTaskDelay(30 * 1000 / portTICK_PERIOD_MS);
            continue;
        }

        serial_println(F("[MQTT] HA sending auto discovery"));
        HA_mqtt.publish(F("homeassistant/sensor/" DEVICE_NAME "/config"), HA_discovery_msg);
        vTaskDelay(15 * 60 * 1000 / portTICK_PERIOD_MS);
    }
}

void sendEnergyToHA(void * parameter){
    if(!HA_mqtt.connected()){
      serial_println(F("[MQTT] Can't send to HA without MQTT. Abort."));
      vTaskDelete(NULL);
    }

    String msg = F("{\"power\":");
        msg.concat(measurements[LOCAL_MEASUREMENTS - 1]);
    msg.concat("}");

    serial_print(F("[MQTT] HA publish: "));
    serial_println(msg);

    HA_mqtt.publish(F("homeassistant/sensor/" DEVICE_NAME "/state"), msg);

    // Task is done!
    vTaskDelete(NULL);
}

#endif
