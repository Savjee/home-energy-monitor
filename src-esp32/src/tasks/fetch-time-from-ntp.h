#ifndef TASK_FETCH_TIME_NTP
#define TASK_FETCH_TIME_NTP

#include <Arduino.h>
#include <WiFi.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include "../config/enums.h"

extern void reconnectWifiIfNeeded();
extern DisplayValues gDisplayValues;

WiFiUDP ntpUDP;

// TODO: this does not take timezones into account! Only UTC for now.
NTPClient timeClient(ntpUDP, "pool.ntp.org", /* offset= */ 3600, /* update interval = */ 60000);

void fetchTimeFromNTP(void * parameter){
    for(;;){
        if(!WiFi.isConnected()){
            vTaskDelay(10*1000 / portTICK_PERIOD_MS);
            continue;
        }

        Serial.println("[NTP] Updating...");
        timeClient.update();

        String timestring = timeClient.getFormattedTime();
        short tIndex = timestring.indexOf("T");
        gDisplayValues.time = timestring.substring(tIndex + 1, timestring.length() -3);
        
        Serial.println("[NTP] Done");

        // Sleep for a minute before checking again
        vTaskDelay(60000 / portTICK_PERIOD_MS);
    }
}

#endif
