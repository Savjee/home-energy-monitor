#ifndef TASK_MEASURE_ELECTRICITY
#define TASK_MEASURE_ELECTRICITY

#include <Arduino.h>
#include "EmonLib.h"

#include "../config/config.h"
#include "../config/enums.h"
#include "mqtt-aws.h"

extern DisplayValues gDisplayValues;
extern EnergyMonitor emon1;
extern short measurements[];
extern short measureIndex;

void measureElectricity(void * parameter)
{
    for(;;){
      Serial.println("[ENERGY] Measuring...");
      long start = millis();

      double amps = emon1.calcIrms(1480);
      double watts = amps * HOME_VOLTAGE;

      gDisplayValues.amps = amps;
      gDisplayValues.watt = watts;

      measurements[measureIndex] = watts;
      measureIndex++;

      if(measureIndex == LOCAL_MEASUREMENTS){
          xTaskCreate(
            uploadMeasurementsToAWS,
            "Upload measurements to AWS",
            10000,             // Stack size (bytes)
            NULL,             // Parameter
            5,                // Task priority
            NULL              // Task handle
          );

          #if HA_ENABLED == true
            xTaskCreate(
              sendEnergyToHA,
              "HA-MQTT Upload",
              10000,             // Stack size (bytes)
              NULL,             // Parameter
              5,                // Task priority
              NULL              // Task handle
            );
          #endif
      }

      long end = millis();

      // Schedule the task to run again in 1 second (while
      // taking into account how long measurement took)
      vTaskDelay((1000-(end-start)) / portTICK_PERIOD_MS);
    }    
}

#endif
