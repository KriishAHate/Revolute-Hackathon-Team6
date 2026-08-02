
sudo ip link set "$PCAN_IF" down 2>/dev/null
sudo ip link set "$PCAN_IF" type can bitrate 1000000 restart-ms 100
sudo ip link set "$PCAN_IF" txqueuelen 1000
sudo ip link set "$PCAN_IF" up
