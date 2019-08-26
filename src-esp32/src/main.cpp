#include <Arduino.h>
#include "EmonLib.h"
#include "WiFi.h"
#include <driver/adc.h>
#include "config/config.h"
#include "classes/AWSConnector.cpp"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiUdp.h>
#include <NTPClient.h>


#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// The state in which the device can be. This mainly affects what
// is drawn on the display.
enum DEVICE_STATE {
  CONNECTING_WIFI,
  CONNECTING_AWS,
  FETCHING_TIME,
  UP,
};

// Place to store all the variables that need to be displayed.
// All other functions should update these!
struct DisplayValues {
  double watt;
  double amps;
  int8_t wifi_strength;
  DEVICE_STATE currentState;
  String time;
};

DisplayValues gDisplayValues;

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);

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
unsigned long timeFinishedSetup = 0;

void goToDeepSleep()
{
  Serial.println("Going to sleep...");
  esp_sleep_enable_timer_wakeup(DEEP_SLEEP_TIME * 60L * 1000000L);
  esp_deep_sleep_start();
}

void drawTime(){
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(gDisplayValues.time);
}

void drawSignalStrength(){
  const byte X = 51;
  const byte X_SPACING = 2;

  // Draw the four base rectangles
  display.fillRect(X, 8-2, 1, 2, WHITE); // Bar 1
  display.fillRect(X + X_SPACING, 8-2, 1, 2, WHITE); // Bar 2
  display.fillRect(X + X_SPACING*2, 8-2, 1, 2, WHITE); // Bar 3
  display.fillRect(X + X_SPACING*3, 8-2, 1, 2, WHITE); // Bar 4

  // Draw bar 2
  if(gDisplayValues.wifi_strength > -70){
    display.fillRect(X+X_SPACING, 8-4, 1, 4, WHITE);
  }

  // Draw bar 3
  if(gDisplayValues.wifi_strength > -60){
    display.fillRect(X+X_SPACING*2, 8-6, 1, 6, WHITE);
  }

  // Draw bar 4
  if(gDisplayValues.wifi_strength >= -50){
    display.fillRect(X+X_SPACING*3, 8-8, 1, 8, WHITE);
  }
}

/**
 * The screen that is displayed when the ESP has just booted
 * and is connecting to WiFi & AWS.
 */
void drawBootscreen(){
  byte X = 14;
  byte Y = 70;
  byte WIDTH = 6;
  byte MAX_HEIGHT = 35;
  byte HEIGHT_STEP = 10;
  byte X_SPACING = 10;

  display.fillRect(X              , Y, WIDTH, MAX_HEIGHT - HEIGHT_STEP*3, WHITE);
  display.fillRect(X + X_SPACING  , Y - HEIGHT_STEP, WIDTH, MAX_HEIGHT - HEIGHT_STEP*2, WHITE);
  display.fillRect(X + X_SPACING*2, Y - HEIGHT_STEP*2, WIDTH, MAX_HEIGHT - HEIGHT_STEP, WHITE);
  display.fillRect(X + X_SPACING*3, Y - HEIGHT_STEP*3, WIDTH, MAX_HEIGHT, WHITE);

  display.setTextSize(1);
  display.setCursor(0, Y + MAX_HEIGHT / 2);
  display.println("Connecting");

  if(gDisplayValues.currentState == CONNECTING_WIFI){
    display.println("   WiFi");
  }

  if(gDisplayValues.currentState == CONNECTING_AWS){
    display.println("   AWS");
  }
}

/**
 * Draw the current amps & watts in the middle of the display.
 */
void drawAmpsWatts(){

  String watts = String(gDisplayValues.watt, 0);
  String amps = String(gDisplayValues.amps, 2);
  
  String lblWatts = "Watt";
  String lblAmps = "Amps";

  const int startY = 30;

  // Calculate how wide (pixels) the text will be once rendered.
  // Each character = 6 pixels, with font size 2, that is 12 pixels.
  // -1 because of the spacing between letters (last one doesn't)
  int widthAmps = (amps.length() * 12) -1;
  int widthLblAmps = lblAmps.length() * 6 - 1;

  int widthWatts = watts.length() * 12 - 1;
  int widthLblWatts = lblWatts.length() * 6 -1;

  display.setTextSize(2);
  display.setCursor((SCREEN_HEIGHT - widthAmps) / 2, startY);
  display.print(amps);

  display.setTextSize(1);
  display.setCursor((SCREEN_HEIGHT - widthLblAmps) / 2, startY + 15);
  display.print(lblAmps);

  display.setTextSize(2);
  display.setCursor((SCREEN_HEIGHT - widthWatts) / 2, startY + 40);
  display.print(watts);

  display.setTextSize(1);
  display.setCursor((SCREEN_HEIGHT - widthLblWatts) / 2, startY + 60);
  display.print(lblWatts);
}

/**
 * Metafunction that takes care of drawing all the different
 * parts of the display (or not if it's turned off).
 */
void updateDisplay(){
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
  delay(500);
}

void connectToWiFi()
{
  gDisplayValues.currentState = CONNECTING_WIFI;
  updateDisplay();

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

void fetchTimeFromNTP(){
  reconnectWifiIfNeeded();
  timeClient.update();
  String timestring = timeClient.getFormattedTime();
  short tIndex = timestring.indexOf("T");
  gDisplayValues.time = timestring.substring(tIndex + 1, timestring.length() -3);
}

void setup()
{
  Serial.begin(115200);
  adc1_config_channel_atten(ADC1_CHANNEL_6, ADC_ATTEN_DB_11);
  analogReadResolution(10);
  Wire.begin(5, 4); // i2c for the OLED panel


  // Initialize the display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C, false, false)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }

  display.clearDisplay(); // Clear Adafruit screen
  display.setRotation(3);
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setTextWrap(false);

  // TEST CODE
  gDisplayValues.currentState = UP;
  gDisplayValues.amps = 6.76;
  gDisplayValues.watt = 230*6.76;
  gDisplayValues.time = "13:37";

  updateDisplay();
  connectToWiFi();

  timeClient.begin();
  timeClient.setTimeOffset(7200); // GMT +1
  timeClient.setUpdateInterval(60 * 1000); // Update every 60 seconds
  
  // Initialize emon library
  emon1.current(ADC_INPUT, 30);


  // lcd.setCursor(3, 0);
  // lcd.print("AWS connect   ");
  // awsConnector.setup();

  timeFinishedSetup = millis();
}

void loop()
{
  Serial.println("updateDisplay!");
  updateDisplay();
  reconnectWifiIfNeeded();
  fetchTimeFromNTP();

  gDisplayValues.wifi_strength = WiFi.RSSI();

  delay(2000);



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