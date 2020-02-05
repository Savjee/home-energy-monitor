#include <Arduino.h>
#include "EmonLib.h"
#include "WiFi.h"
#include <driver/adc.h>
#include "config/config.h"
#include "functions/drawFunctions.h"
#include "config/enums.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include "tasks/updateDisplay.cpp"
#include "tasks/mqtt-aws.cpp"
#include "tasks/wifi-connection.cpp"
#include "tasks/wifi-update-signalstrength.cpp"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DisplayValues gDisplayValues;
EnergyMonitor emon1;
WiFiUDP ntpUDP;

// TODO: this does not take timezones into account! Only UTC for now.
NTPClient timeClient(ntpUDP, "pool.ntp.org", /* offset= */ 3600, /* update interval = */ 60000);

// Place to store local measurements before sending them off to AWS
short measurements[LOCAL_MEASUREMENTS];
short measureIndex = 0;

void goToDeepSleep()
{
  Serial.println("Going to sleep...");
  esp_sleep_enable_timer_wakeup(DEEP_SLEEP_TIME * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void measureElectricity(void * parameter)
{
    for(;;){
      Serial.println("Taking measurement...");
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
      }

      long end = millis();

      // Schedule the task to run again in 1 second (while
      // taking into account how long measurement took)
      vTaskDelay((1000-(end-start)) / portTICK_PERIOD_MS);
    }    
}

void fetchTimeFromNTP(void * parameter){
  for(;;){
    Serial.println("Updating NTP time...");
    reconnectWifiIfNeeded();

    timeClient.update();
    String timestring = timeClient.getFormattedTime();
    short tIndex = timestring.indexOf("T");
    gDisplayValues.time = timestring.substring(tIndex + 1, timestring.length() -3);
    Serial.println("--> Done NTP update");

    // Sleep for a minute before checking again
    vTaskDelay(60000 / portTICK_PERIOD_MS);
  }
}


void setup()
{
  Serial.begin(115200);

  // Setup the ADC
  adc1_config_channel_atten(ADC1_CHANNEL_0, ADC_ATTEN_DB_11);
  analogReadResolution(ADC_BITS);
  pinMode(ADC_INPUT, INPUT);

  // i2c for the OLED panel
  Wire.begin(5, 4); 

  // Initialize the display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C, false, false)) {
    Serial.println(F("SSD1306 allocation failed"));
    goToDeepSleep();
  }

  display.clearDisplay(); // Clear Adafruit screen
  display.setRotation(3);
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setTextWrap(false);

  xTaskCreatePinnedToCore(
    keepWiFiAlive,    // Function to call
    "keepWiFiAlive",  // Task name
    20000,            // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL,             // Task handle
    ARDUINO_RUNNING_CORE
  );

  // ----------------------------------------------------------------
  // TASK: Connect to AWS & keep the connection alive.
  // ----------------------------------------------------------------
  xTaskCreate(
    keepAWSConnectionAlive,
    "MQTT-AWS",      // Task name
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    5,                // Task priority
    NULL              // Task handle
  );

  // TASK: Update the display every second
  //       This is pinned to the same core as Arduino
  //       because it would otherwise corrupt the OLED
  xTaskCreatePinnedToCore(
    updateDisplay,    // Function to call
    "UpdateDisplay",  // Task name
    20000,            // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL,             // Task handle
    ARDUINO_RUNNING_CORE
  );

  // Task: measure electricity consumption ;)
  xTaskCreate(
    measureElectricity,
    "Measure electricity",  // Task name
    10000,                  // Stack size (bytes)
    NULL,                   // Parameter
    4,                      // Task priority
    NULL                    // Task handle
  );

  // TASK: update time from NTP server.
  xTaskCreate(
    fetchTimeFromNTP,
    "Update NTP time",
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL              // Task handle
  );

  // TASK: update WiFi signal strength
  xTaskCreate(
    updateWiFiSignalStrength,
    "Update WiFi strength",
    1000,             // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL              // Task handle
  );

  // Connect to WiFi and start the NTP client  
  timeClient.begin();

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);

}

void loop()
{
  // reconnectWifiIfNeeded();
  // vTaskDelay(10000 / portTICK_PERIOD_MS);
}