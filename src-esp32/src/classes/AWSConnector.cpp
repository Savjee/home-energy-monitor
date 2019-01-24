#ifndef CLASS_AWSCONNECTOR
#define CLASS_AWSCONNECTOR

#include "../config/config.h"
#include "../config/aws_iot_certificates.h"
#include <WiFiClientSecure.h>
#include <MQTTClient.h>

class AWSConnector
{
  public:
    static AWSConnector* instance;
    WiFiClientSecure net = WiFiClientSecure();
    MQTTClient client = MQTTClient(512);

    /**
     * Called when the ESP32 is in setup mode. Will only be called once
     * when the chip is booting up or wakping up from deep sleep.
     */
    void setup(){
      connect();
    }

    void loop(){
      client.loop();
      delay(10); // Should fix instabilities

      // Make sure the MQTT client is still connected
      if (!client.connected()) {
        connect();
      }
    }

    void sendMessage(String msg){
      client.publish("***REMOVED***", msg);
    }

  private:
    void connect(){
      int retries = 0;

      net.setCACert(AWS_CERT_CA);
      net.setCertificate(AWS_CERT_CRT);
      net.setPrivateKey(AWS_CERT_PRIVATE);

      // Connect to the MQTT broker
      client.begin(AWS_IOT_ENDPOINT, 8883, net);

      // Try to connect to AWS and count how many times we retried.
      // After reaching the maximum we should stop!
      Serial.print("Connecting to AWS IOT...");
      while (!client.connect("xd-home-energy-monitor-1") && retries < AWS_MAX_RECONNECT_TRIES) {
        Serial.print(".");
        delay(AWS_RECONNECT_DELAY);
        retries++;
      }

      // Make sure that we did indeed successfully connect to the MQTT broker
      // If not we just end the function and wait for the next loop.
      if(!client.connected()){
        Serial.println(" Timeout!");
        return;
      }

      // If we land here, we have successfully connected to AWS!
      // And we can subscribe to topics and send messages.
      Serial.println("Connected!");
    }
};

#endif