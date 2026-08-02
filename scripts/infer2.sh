rm -r ~/.cache/huggingface/lerobot/seeed_rebot_b601_rs/eval_test4/


lerobot-record \
  --robot.type=seeed_b601_rs_follower \
  --robot.port=can0 \
  --robot.can_adapter=socketcan \
  --robot.cameras='{ front: {type: opencv, index_or_path: 0, width: 640, height: 480, fps: 30, fourcc: "MJPG"}, side: {type: opencv, index_or_path: 2, width: 640, height: 480, fps: 30, fourcc: "MJPG"} }' \
  --robot.id=follower1 \
  --display_data=false \
  --dataset.repo_id=seeed_rebot_b601_rs/eval_test4 \
  --dataset.single_task="Grab the black cube" \
   --dataset.push_to_hub=false \
   --teleop.type=rebot_arm_102_leader \
   --teleop.port=/dev/ttyUSB0 \
   --teleop.id=rebot_arm_102_leader \
   --policy.path=outputs/train/act_rebot_test/checkpoints/000001/pretrained_model
