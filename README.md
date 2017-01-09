EtehrMesh
=========


Configuration Steps
-------------------

Step 1: Setup CJDNS - https://github.com/tomeshnet/prototype-cjdns-pi2

Step 2: sudo apt-get update

Step 3: sudo apt-get install matchbox-window-manager xautomation epiphany-browser xorg

Step 4: Setup the SPI LCD screen

Run ./LCD35-show (from LCD-show-160701.tar.gz)

Step 5: Setup xinit (choose seller or buyer)

/root/.xinitrc

```
xset -dpms
xset s off
xset s noblank

xte 'sleep 5' 'key F11' &

matchbox-window-manager -use_titlebar no&
WEBKIT_DISABLE_TBS=1 epiphany-browser file:///home/pi/ethermesh/seller.html
```

/usr/share/X11/xorg.conf.d/99-pitft.conf

```
Section "Device"
  Identifier "Adafruit PiTFT"
  Driver "fbdev"
  Option "fbdev" "/dev/fb1"
EndSection
```

Step 6: Install the ethermesh services

Step 7: Setup auto-launch of xinit and ethermesh services
