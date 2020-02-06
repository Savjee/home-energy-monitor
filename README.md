<p align="center">
    <a href="https://github.com/Savjee/home-energy-monitor" rel="noopener">
        <img width=200px height=200px src="https://savjee.github.io/home-energy-monitor/readme-images/logo.png" alt="Home Energy Monitor">
    </a>
</p>

<h3 align="center">Home Energy Monitor (v2)</h3>

<div align="center">

[![GitHub Issues](https://img.shields.io/github/issues/Savjee/home-energy-monitor.svg)](https://github.com/Savjee/home-energy-monitor/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/Savjee/home-energy-monitor.svg)](https://github.com/Savjee/home-energy-monitor/pulls)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

**⚠️ This is a work in progress. Only the ESP32 firmware is considered stable.**
</div>

---

ESP32-based Home Energy Monitor: monitors electricity consumption of your entire house with a single CT sensor.

## Structure

This project consists out of multiple components:

| Folder            | Description         | Build status | 
| ----------------- | ------------------- | ------------ | 
| `src-app`         | Mobile app (Ionic)  | n/a |
| `src-aws`         | Serverless AWS backend + GraphQL API | ![AWS Build Status](https://github.com/Savjee/home-energy-monitor/workflows/aws/badge.svg) |
| `src-esp32`       | Firmware for the ESP32 (measuring device) | ![Firmware Build Status](https://github.com/Savjee/home-energy-monitor/workflows/firmware/badge.svg) |

(TODO: add instructions on how to deploy all of this. 😅)

## Video explanation

<div align="center">

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/ah3ezprtgmc/0.jpg)](https://www.youtube.com/watch?v=ah3ezprtgmc)

*[https://www.youtube.com/watch?v=ah3ezprtgmc](https://www.youtube.com/watch?v=ah3ezprtgmc)*
</div>


## Screenshots

Web dashboard, built on top of the GraphQL API:
![Screenshot Web Dashboard](https://savjee.github.io/home-energy-monitor/readme-images/web-dashboard.png)

What is displayed on the ESP32 OLED display:
![Screenshot ESP32 OLED](https://savjee.github.io/home-energy-monitor/readme-images/esp32-oled.jpg)


## DIY Requirements

To build your own Energy Monitor you need the following hardware:

* ESP32
* CT sensor: YHDC SCT-013-030 (30A/1V)
* 10µF capacitor
* 2 resistors (between 10k-470kΩ)

Other requirements:
* AWS Account (Should be able to run in free-tier)
* Install [PlatformIO](https://platformio.org) on your system
* Drivers for your ESP32 board

Read my blog post for more instructions: [https://savjee.be/2019/07/Home-Energy-Monitor-ESP32-CT-Sensor-Emonlib/](https://savjee.be/2019/07/Home-Energy-Monitor-ESP32-CT-Sensor-Emonlib/)


## Contribute

I'm happy to merge in any pull requests. Also feel free to report bugs or feature requests.