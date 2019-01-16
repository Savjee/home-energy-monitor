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

// milliseconds
long lastAwsUpdate = 0;

// Set the LCD address to 0x27 for a 16 chars and 2 line display
LiquidCrystal_I2C lcd(0x27, 16, 2);

EnergyMonitor emon1;

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

  lcd.begin();

  connectToWiFi();

  // Initialize emon library
  emon1.current(ADC_INPUT, 30);

  awsConnector.setup();
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

void loop()
{
  unsigned long currentMillis = millis();

  double amps = emon1.calcIrms(1480); // Calculate Irms only
  double watt = amps * HOME_VOLTAGE;

  // Update the display
  writeEnergyToDisplay(watt, amps);

  // Send data to AWS
  if (currentMillis - lastAwsUpdate > AWS_MESSAGE_INTERVAL)
  {
    awsConnector.sendMessage("{\"watts\": 0, \"amps\": 0}");
    lastAwsUpdate = currentMillis;
  }

  awsConnector.loop();
  delay(500);
}

void sendToThingSpeak(double amps, double watts)
{
  //   WiFiClientSecure client;

  //   client.setTimeout(5); // Only wait 5 seconds before stopping the request!

  //   Serial.print("connecting to ");
  //   Serial.println(host);

  //   if (!client.connect(host, httpsPort)) {
  //     Serial.println("connection failed");
  //     return;
  //   }

  //   String url = "/update?api_key=";
  //   url += api_key;
  //   url += "&field1=";
  //   url += String(watts);
  //   url += "&field2=";
  //   url += String(amps);
  //   url += "&field3=";
  //   url += WiFi.RSSI();
  //   url += "\r\n";

  //   client.print(String("GET ") + url + " HTTP/1.1\r\n" +
  //                "Host: " + host + "\r\n" +
  //                "Connection: close\r\n\r\n");

  //   Serial.println("request sent");

  // //  while (client.connected()) {
  // //    String line = client.readStringUntil('\n');
  // //    if (line == "\r") {
  // //      Serial.println("headers received");
  // //      break;
  // //    }
  // //  }

  //   lcd.setCursor(3,0);
  //   lcd.print(WiFi.localIP());
}