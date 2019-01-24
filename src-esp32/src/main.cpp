#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include "EmonLib.h"
#include "WiFi.h"
#include <driver/adc.h>
#include "config/config.h"
#include "classes/AWSConnector.cpp"

// Create an instance of our AWS Connector
AWSConnector awsConnector;

// Wifi credentials
const char *ssid = "***REMOVED***";
const char *password = "***REMOVED***";

// Set the LCD address to 0x27 for a 16 chars and 2 line display
LiquidCrystal_I2C lcd(0x27, 16, 2);

EnergyMonitor emon1;

short measurements[30];
short measureIndex = 0;
unsigned long lastMeasurement = 0;
unsigned long timeFinishedSetup = 0;

void connectToWiFi()
{
  lcd.clear();

  // Colum 3 because the first two are broken
  lcd.setCursor(3, 0);
  lcd.print("WiFi...      ");

  WiFi.mode(WIFI_STA);
  WiFi.setHostname("esp32-energy-monitor");
  WiFi.begin(ssid, password);
  Serial.println("");

  Serial.print("Connecting");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 15)
  {
    delay(500);
    Serial.print(".");
    retries++;
  }

  lcd.setCursor(3, 0);
  lcd.print(WiFi.localIP());
}

void setup()
{
  adc1_config_channel_atten(ADC1_CHANNEL_6, ADC_ATTEN_DB_11);
  analogReadResolution(10);
  Serial.begin(115200);

  lcd.init();
  lcd.backlight();

  connectToWiFi();

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);


  lcd.setCursor(3, 0);
  lcd.print("AWS connect   ");
  awsConnector.setup();

  timeFinishedSetup = millis();
}

void writeEnergyToDisplay(double watts, double amps)
{
  // Colum 3 because the first two are broken
  lcd.setCursor(3, 1);

  lcd.print((int)watts);
  lcd.print("W ");
  lcd.print(amps);
  lcd.print("A    ");
}

void printIPAddress(){
  lcd.setCursor(3,0);
  lcd.print(WiFi.localIP());
}

void loop()
{
  unsigned long currentMillis = millis();

  // If it's been longer then 1000ms since we took a measurement, take one now!
  if(currentMillis - lastMeasurement > 1000)
  {
    Serial.println("Taking measurement..");
    double amps = emon1.calcIrms(1480); // Calculate Irms only
    double watt = amps * HOME_VOLTAGE;

    // Update the display
    writeEnergyToDisplay(watt, amps);

    lastMeasurement = millis();

    // If we haven't been online for more then 5 seconds, ignore all the
    // readings because they need to stabilize!
    if(millis() - timeFinishedSetup < 10000){
      lcd.setCursor(3, 0);
      lcd.print("Startup mode   ");
    }else{
      printIPAddress();
      measurements[measureIndex] = watt;
      measureIndex++;
    }
  }

  // Send data to AWS when we have 30 measurements
  if (measureIndex == 30)
  {
    lcd.setCursor(3,0);
    lcd.print("AWS upload..   ");
    String msg = "{\"readings\": [";

    for (short i = 0; i <= 28; i++){
      msg += measurements[i];
      msg += ",";
    }

    msg += measurements[29];
    msg += "]}";

    Serial.println(msg);

    awsConnector.sendMessage(msg);
    measureIndex = 0;
  }

  awsConnector.loop();
}