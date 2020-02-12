#ifndef CONFIG
#define CONFIG

/**
 * Set this to false to disable Serial logging
 */
#define DEBUG true

/**
 * The name of this device (as defined in the AWS IOT console).
 * Also used to set the hostname on the network
 */
#define DEVICE_NAME "*****YOUR AWS IOT DEVICE NAME******"

/**
 * ADC input pin that is used to read out the CT sensor
 */
#define ADC_INPUT 36

/**
 * The voltage of your home, used to calculate the wattage.
 * Try setting this as accurately as possible.
 */
#define HOME_VOLTAGE 245.0

/**
 * WiFi credentials
 */
#define WIFI_NETWORK "****** YOUR WIFI NETWORK NAME *******"
#define WIFI_PASSWORD "****** YOUR WIFI PASSWORD *******"

/**
 * Timeout for the WiFi connection. When this is reached,
 * the ESP goes into deep sleep for 30seconds to try and
 * recover.
 */
#define WIFI_TIMEOUT 20000 // 20 seconds

/**
 * How long should we wait after a failed WiFi connection
 * before trying to set one up again.
 */
#define WIFI_RECOVER_TIME_MS 20000 // 20 seconds

/**
 * Dimensions of the OLED display attached to the ESP
 */
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

/**
 * Force Emonlib to assume a 3.3V supply to the CT sensor
 */
#define emonTxV3 1


/**
 * Local measurements
 */
#define LOCAL_MEASUREMENTS 30


/**
 * The MQTT endpoint of the service we should connect to and receive messages
 * from.
 */
#define AWS_IOT_ENDPOINT "**** YOUR AWS IOT ENDPOINT ****"
#define AWS_IOT_TOPIC "**** YOUR AWS IOT RULE ARN ****"

#define MQTT_CONNECT_DELAY 200
#define MQTT_CONNECT_TIMEOUT 20000 // 20 seconds

/**
 * Wether or not you want to enable Home Assistant integration
 */
#define HA_ENABLED false
#define HA_ADDRESS "*** YOUR HOME ASSISTANT IP ADDRESSS ***"
#define HA_PORT 8883
#define HA_USER "*** MQTT USER ***"
#define HA_PASSWORD "*** MQTT PASSWORD ***"

// Check which core Arduino is running on. This is done because updating the 
// display only works from the Arduino core.
#if CONFIG_FREERTOS_UNICORE
#define ARDUINO_RUNNING_CORE 0
#else
#define ARDUINO_RUNNING_CORE 1
#endif

#endif