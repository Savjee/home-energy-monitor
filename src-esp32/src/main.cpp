#include <Arduino.h>
#include "EmonLib.h"
#include "WiFi.h"
#include <driver/adc.h>
#include "config/config.h"
#include "functions/AWSConnector.cpp"
#include "functions/drawFunctions.h"
#include "config/enums.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include "tasks/updateDisplay.cpp"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DisplayValues gDisplayValues;
AWSConnector awsConnector;
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

/**
 * TASK: Upload measurements to AWS. This only works when there are enough
 * local measurements. It's called by the measurement function.
 */
void uploadMeasurementsToAWS(void * parameter){
    if(!WiFi.isConnected())
    {
      Serial.println("Can't send to AWS without WiFi! Discarding...");
      measureIndex = 0;
    }

    if (measureIndex == LOCAL_MEASUREMENTS)
    {
      String msg = "{\"readings\": [";

      for (short i = 0; i < LOCAL_MEASUREMENTS-1; i++){
        msg += measurements[i];
        msg += ",";
      }

      msg += measurements[LOCAL_MEASUREMENTS-1];
      msg += "]}";

      Serial.println(msg);

      awsConnector.sendMessage(msg);
      measureIndex = 0;
    }

    // Task is done!
    vTaskDelete(NULL);
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

void connectToWiFi()
{
  gDisplayValues.currentState = CONNECTING_WIFI;

  Serial.print("Connecting to WiFi... ");
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(DEVICE_NAME);
  WiFi.begin(WIFI_NETWORK, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();

  // Keep looping while we're not connected and haven't reached the timeout
  while (WiFi.status() != WL_CONNECTED && 
          millis() - startAttemptTime < WIFI_TIMEOUT){}

  // Make sure that we're actually connected, otherwise go to deep sleep
  if(WiFi.status() != WL_CONNECTED){
    Serial.println("FAILED");
    goToDeepSleep();
  }

  Serial.println("OK");
  Serial.println(WiFi.localIP());
  gDisplayValues.currentState = UP;
}

void reconnectWifiIfNeeded(){
  if(WiFi.status() != WL_CONNECTED){
    connectToWiFi();
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

void loopAWSMQTTConnection(void * parameters){
  for(;;){
    awsConnector.loop();

    // Sleep for half a second, then loop again
    vTaskDelay(500 / portTICK_PERIOD_MS);
  }
}

/**
 * TASK: Get the current WiFi signal strength and write it to the
 * displayValues so it can be shown by the updateDisplay task
 */
void updateWiFiSignalStrength(void * parameter){
  for(;;){
    if(WiFi.isConnected()){
      Serial.println("Updating WiFi signal strength...");
      gDisplayValues.wifi_strength = WiFi.RSSI();
    }

    // Sleep for 10 seconds
    vTaskDelay(10000 / portTICK_PERIOD_MS);
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
  connectToWiFi();
  awsConnector.setup();
  timeClient.begin();

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);

  xTaskCreate(
    loopAWSMQTTConnection,
    "Loop MQTT",      // Task name
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    5,                // Task priority
    NULL              // Task handle
  );
}

void loop()
{
  reconnectWifiIfNeeded();
  vTaskDelay(10000 / portTICK_PERIOD_MS);
}