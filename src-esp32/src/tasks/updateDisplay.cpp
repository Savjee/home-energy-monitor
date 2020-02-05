#ifndef TASK_UPDATE_DISPLAY
#define TASK_UPDATE_DISPLAY

#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include "functions/drawFunctions.h"
#include "../config/config.h"

extern Adafruit_SSD1306 display;
extern DisplayValues gDisplayValues;

/**
 * Metafunction that takes care of drawing all the different
 * parts of the display (or not if it's turned off).
 */
void updateDisplay(void * parameter){
  for (;;) // A Task shall never return or exit.
  {
    Serial.println("Updating display...");
    display.clearDisplay();

    if(gDisplayValues.currentState == CONNECTING_WIFI || 
        gDisplayValues.currentState == CONNECTING_AWS)
    {
      drawBootscreen();
    }
    
    if(gDisplayValues.currentState == UP){
      drawTime();
      drawSignalStrength();
      drawAmpsWatts();
      drawMeasurementProgress();
    }

    display.display();

    // Sleep for 2 seconds, then update display again!
    vTaskDelay(2000 / portTICK_PERIOD_MS);
  }
}

#endif
