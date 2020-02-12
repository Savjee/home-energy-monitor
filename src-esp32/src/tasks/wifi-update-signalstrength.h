#ifndef TASK_UPDATE_WIFI_SIGNAL
#define TASK_UPDATE_WIFI_SIGNAL

#include <Arduino.h>
#include "WiFi.h"
#include "../config/enums.h"

extern DisplayValues gDisplayValues;

/**
 * TASK: Get the current WiFi signal strength and write it to the
 * displayValues so it can be shown by the updateDisplay task
 */
void updateWiFiSignalStrength(void * parameter){
  for(;;){
    if(WiFi.isConnected()){
      serial_println(F("[WIFI] Updating signal strength..."));
      gDisplayValues.wifi_strength = WiFi.RSSI();
    }

    // Sleep for 10 seconds
    vTaskDelay(10000 / portTICK_PERIOD_MS);
  }
}

#endif