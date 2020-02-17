#include <Arduino.h>
#include "EmonLib.h"
#include "WiFi.h"
#include <driver/adc.h>
#include "config/config.h"
#include "config/enums.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "tasks/updateDisplay.h"
#include "tasks/fetch-time-from-ntp.h"
#include "tasks/mqtt-aws.h"
#include "tasks/wifi-connection.h"
#include "tasks/wifi-update-signalstrength.h"
#include "tasks/measure-electricity.h"
#include "tasks/mqtt-home-assistant.h"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DisplayValues gDisplayValues;
EnergyMonitor emon1;

// Place to store local measurements before sending them off to AWS
unsigned short measurements[LOCAL_MEASUREMENTS];
unsigned char measureIndex = 0;

void setup()
{
  #if DEBUG == true
    Serial.begin(115200);
  #endif 

  // Setup the ADC
  adc1_config_channel_atten(ADC1_CHANNEL_0, ADC_ATTEN_DB_11);
  analogReadResolution(ADC_BITS);
  pinMode(ADC_INPUT, INPUT);

  // i2c for the OLED panel
  Wire.begin(5, 4); 

  // Initialize the display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C, false, false)) {
    serial_println(F("SSD1306 allocation failed"));
    delay(10*1000);
    ESP.restart();
  }

  // Init the display
  display.clearDisplay();
  display.setRotation(3);
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setTextWrap(false);

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);

  // ----------------------------------------------------------------
  // TASK: Connect to WiFi & keep the connection alive.
  // ----------------------------------------------------------------
  xTaskCreatePinnedToCore(
    keepWiFiAlive,
    "keepWiFiAlive",  // Task name
    5000,            // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL,             // Task handle
    ARDUINO_RUNNING_CORE
  );

  // ----------------------------------------------------------------
  // TASK: Connect to AWS & keep the connection alive.
  // ----------------------------------------------------------------
  #if AWS_ENABLED == true
    xTaskCreate(
      keepAWSConnectionAlive,
      "MQTT-AWS",      // Task name
      5000,            // Stack size (bytes)
      NULL,             // Parameter
      5,                // Task priority
      NULL              // Task handle
    );
  #endif

  // ----------------------------------------------------------------
  // TASK: Update the display every second
  //       This is pinned to the same core as Arduino
  //       because it would otherwise corrupt the OLED
  // ----------------------------------------------------------------
  xTaskCreatePinnedToCore(
    updateDisplay,
    "UpdateDisplay",  // Task name
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    3,                // Task priority
    NULL,             // Task handle
    ARDUINO_RUNNING_CORE
  );

  // ----------------------------------------------------------------
  // Task: measure electricity consumption ;)
  // ----------------------------------------------------------------
  xTaskCreate(
    measureElectricity,
    "Measure electricity",  // Task name
    5000,                  // Stack size (bytes)
    NULL,                   // Parameter
    4,                      // Task priority
    NULL                    // Task handle
  );

  // ----------------------------------------------------------------
  // TASK: update time from NTP server.
  // ----------------------------------------------------------------
  #if NTP_TIME_SYNC_ENABLED == true
    xTaskCreate(
      fetchTimeFromNTP,
      "Update NTP time",
      5000,            // Stack size (bytes)
      NULL,             // Parameter
      1,                // Task priority
      NULL              // Task handle
    );
  #endif

  // ----------------------------------------------------------------
  // TASK: update WiFi signal strength
  // ----------------------------------------------------------------
  xTaskCreate(
    updateWiFiSignalStrength,
    "Update WiFi strength",
    1000,             // Stack size (bytes)
    NULL,             // Parameter
    2,                // Task priority
    NULL              // Task handle
  );

  #if HA_ENABLED == true
    xTaskCreate(
      HADiscovery,
      "MQTT-HA Discovery",  // Task name
      5000,                // Stack size (bytes)
      NULL,                 // Parameter
      5,                    // Task priority
      NULL                  // Task handle
    );

    xTaskCreate(
      keepHAConnectionAlive,
      "MQTT-HA Connect",
      5000,
      NULL,
      4,
      NULL
    );
  #endif
}

void loop()
{
  vTaskDelay(10000 / portTICK_PERIOD_MS);
}