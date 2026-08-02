lerobot-record \
  --robot.type=seeed_b601_rs_follower \
  --robot.port=$PORT_IF \
  --robot.can_adapter=socketcan \
  --robot.cameras='{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30, fourcc: "MJPG"}, side: {type: opencv, index_or_path: 2, width: 640, height: 480, fps: 30, fourcc: "MJPG"} }' \
  --robot.id=follower1 \
  --display_data=false \
  --dataset.single_task="Grab the black cube" \
  --policy.path=outputs/train/act_rebot_test/checkpoints/last/pretrained_model \
  --dataset.repo_id=seeed_rebot_b601_rs/orange-fixed_4 
