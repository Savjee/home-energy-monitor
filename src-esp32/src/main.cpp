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

DisplayValues gDisplayValues;

WiFiUDP ntpUDP;

// TODO: this does not take timezones into account! Only UTC for now.
NTPClient timeClient(ntpUDP, "pool.ntp.org", /* offset= */ 3600, /* update interval = */ 60000);

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Create an instance of our AWS Connector
AWSConnector awsConnector;

// Wifi credentials
const char *WIFI_NETWORK = "***REMOVED***";
const char *WIFI_PASSWORD = "***REMOVED***";

EnergyMonitor emon1;

short measurements[30];
short measureIndex = 0;
unsigned long lastMeasurement = 0;

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
      emon1.calcVI(10, 1000);         // Calculate all. No.of half wavelengths (crossings), time-out
      emon1.serialprint();

      gDisplayValues.amps = emon1.Irms;
      gDisplayValues.watt = gDisplayValues.amps * HOME_VOLTAGE;

      vTaskDelay(1000 / portTICK_PERIOD_MS);
    }    
}

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
    }

    display.display();
   
    // Sleep for 1 second, then update display again!
    vTaskDelay(2000 / portTICK_PERIOD_MS);
  }
}

void connectToWiFi()
{
  gDisplayValues.currentState = CONNECTING_WIFI;
  // updateDisplay();

  Serial.print("Connecting to WiFi... ");
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("esp32-energy-monitor-2");
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

void updateWiFiSignalStrength(void * parameter){
  for(;;){
    if(WiFi.isConnected()){
      Serial.println("Updating WiFi signal strength...");
      gDisplayValues.wifi_strength = WiFi.RSSI();
      Serial.println("--> Done WiFi signal strength update");
    }

    // Sleep for 10 seconds
    vTaskDelay(10000 / portTICK_PERIOD_MS);
  }
}

void setup()
{
  Serial.begin(115200);
  adc1_config_channel_atten(ADC1_CHANNEL_0, ADC_ATTEN_DB_11);
  analogReadResolution(ADC_BITS);
  pinMode(ADC_INPUT, INPUT);

  Wire.begin(5, 4); // i2c for the OLED panel


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

  // TEST CODE
  // gDisplayValues.currentState = UP;
  // gDisplayValues.amps = 6.76;
  // gDisplayValues.watt = 230*6.76;
  // gDisplayValues.time = "13:37";

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
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    1,                // Task priority
    NULL              // Task handle
  );

  // TASK: update time from NTP server.
  xTaskCreate(
    fetchTimeFromNTP,
    "Update NTP time",
    10000,            // Stack size (bytes)
    NULL,             // Parameter
    2,                // Task priority
    NULL              // Task handle
  );

  // TASK: update WiFi signal strength
  xTaskCreate(
    updateWiFiSignalStrength,
    "Update WiFi strength",
    1000,            // Stack size (bytes)
    NULL,             // Parameter
    2,                // Task priority
    NULL              // Task handle
  );
  // Connect to WiFi and start the NTP client  
  connectToWiFi();
  timeClient.begin();

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);
}

void loop()
{
  // updateDisplay();
  reconnectWifiIfNeeded();
  // fetchTimeFromNTP();
  // measureElectricity();
  // delay(500);



  // unsigned long currentMillis = millis();

  // // If it's been longer then 1000ms since we took a measurement, take one now!
  // if(currentMillis - lastMeasurement > 1000)
  // {
  //   Serial.println("Taking measurement..");
  //   double amps = emon1.calcIrms(1480); // Calculate Irms only
  //   double watt = amps * HOME_VOLTAGE;

  //   // Update the display
  //   writeEnergyToDisplay(watt, amps);

  //   lastMeasurement = millis();

  //   // If we haven't been online for more then 5 seconds, ignore all the
  //   // readings because they need to stabilize!
  //   if(millis() - timeFinishedSetup < 10000){
  //     // lcd.setCursor(3, 0);
  //     // lcd.print("Startup mode   ");
  //   }else{
  //     printIPAddress();
  //     measurements[measureIndex] = watt;
  //     measureIndex++;
  //   }
  // }

  // // Send data to AWS when we have 30 measurements
  // if (measureIndex == 30)
  // {
  //   // lcd.setCursor(3,0);
  //   // lcd.print("AWS upload..   ");
  //   String msg = "{\"readings\": [";

  //   for (short i = 0; i <= 28; i++){
  //     msg += measurements[i];
  //     msg += ",";
  //   }

  //   msg += measurements[29];
  //   msg += "]}";

  //   Serial.println(msg);

  //   awsConnector.sendMessage(msg);
  //   measureIndex = 0;
  // }

  // if(WiFi.status() != WL_CONNECTED)
  // {
  //   connectToWiFi();
  // }

  // awsConnector.loop();
}