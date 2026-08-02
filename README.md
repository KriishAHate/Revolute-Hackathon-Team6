# 🍊 Fruitinator

*A robot arm's journey from "let's plate a beautiful charcuterie board" to "please just pick up the orange" to "...why did it destroy the orange."*

Built at [Revolute](https://revolutehack.com/) — Boston's first robotics + physical AI hackathon. Theme: cooking with robot arms. Reality: cooking with our own sanity.

---

## One-Liner

Fruitinator picks and places a fruit — and sometimes destroys it instead. Which is, appropriately, also a decent summary of what happens when you try to train a manipulation policy in two days.

## TL;DR

An SO-100-class arm (reBot B601 RS) watches two cameras, learns from teleop demonstrations, and tries to autonomously pick up a piece of fruit — orange, lychee, or grape. It sometimes succeeds. It sometimes doesn't. It sometimes has *opinions* about the fruit.

---

## 📉 The Descent

*A timeline of a charcuterie board slowly, painfully becoming an orange.*

### Hour 0–?: The Jetson has other plans
The Jetson decided setup day was optional. Certain libraries were locked to specific versions that didn't play nice with each other — the kind of dependency hell where fixing one thing breaks two more. `lerobot-calibrate` couldn't even find its own interpreter, then couldn't find the `lerobot` module at all.

### Rage quit → new laptop
Eventually we cut our losses and started fresh on a different laptop entirely. Sometimes the fix isn't debugging harder, it's a clean slate.

### The Great Downgrade: board → orange (→ lychee → grape)
Ambition met reality. We scaled the plan down from a full charcuterie board to individual fruit — orange, lychee, and grape got the teleop treatment one at a time.

### Gripper drama
The gripper was the recurring troublemaker throughout — the part most likely to hold, drop, or straight-up ignore whatever fruit was in front of it. Every fix here bought a few good runs before something else went sideways again.

---

## 📸 Media

Photos and demo footage from the build live on our shared Drive folder / demo video rather than in this repo.

## 🛠️ System Architecture & Story

### 🦾 Arm Setup
- **Follower arm**: reBot Arm B601 RS (`seeed_b601_rs_follower`), connected over CAN bus via SocketCAN
- **Leader arm**: `rebot_arm_102_leader`, connected over serial (`/dev/ttyUSB0`)
- CAN interface brought up at **1 Mbps** (`bitrate 1000000`, `restart-ms 100`, `txqueuelen 1000`) before anything else could talk to the arm
- Verified the link with `lerobot-teleoperate` (leader → follower) before recording any data

### 🎮 Teleoperation & Data Collection
- Recorded via `lerobot-record` with **two USB cameras**: `front` (index 0) and `side` (index 2), both 640×480 @ 30fps, MJPG
- **50 episodes** recorded per fruit — orange, lychee, and grape — at **15s per episode** with a **7s reset** between each
- Fun fact: the lychee and grape datasets are named `*-fixed-10` even though 50 episodes were actually recorded for each — a naming leftover nobody caught in time
- Bigger fun fact: **every single dataset's task label still says `"Grab the black cube"`** — a copy-pasted placeholder from the original starter template that survived all the way through, even for a project literally called Fruitinator
- Orange and lychee datasets were later **merged** into one (`lerobot-edit-dataset --operation.type merge`)

### 🧠 Model Training & Fine-Tuning
- Policy: **ACT (Action Chunking Transformer)**, via `lerobot-train`
- Orange: trained for **50,000 steps** (`act_orange-50-run2`)
- Lychee: trained for **50,000 steps** (`act_lychee`)
- An earlier template/test run (`orange-fixed_4`) was trained for only **20,000 steps** — a shorter, earlier pass before scaling up
- All runs: `policy.device=cuda`, W&B logging disabled, no push to hub

### 🚀 Edge Deployment / Inference
- Evaluation run via `lerobot-record`, loading the trained checkpoint (`checkpoints/050000/pretrained_model`) directly on hardware — no separate "inference-only" script, eval just re-runs the record pipeline with a policy attached instead of a human
- Ran separate eval passes for orange and lychee, logged as new `eval_test_*` datasets for review
- Recorded runs on both fruits: at least one clean successful pick, and at least one drop/miss — captured on video (see Media section above)

---

## 🎬 Current Status

**Partially working.** The trained policy (ACT, 50k steps) can pick up fruit — but grip and release aren't fully reliable yet. Sometimes it gets a clean grasp, sometimes it drops the fruit mid-transit, and sometimes it just... misses. Consider it a solid proof of concept with an honest amount of "it depends on the fruit's mood that day."

What's confirmed working end-to-end:
- CAN bus + camera pipeline stable
- Teleop recording pipeline solid (150 episodes across 3 fruits)
- ACT policy trains and loads onto hardware for inference

What's still cursed:
- Grasp reliability (drops / misses)
- Consistency across different fruit shapes/sizes

---

## 🧠 What We'd Do Differently

- Actually update the task label instead of shipping "Grab the black cube" to production for a fruit-picking robot
- Fix dataset naming *before* recording 50 episodes, not after
- Test the CAN bus and camera setup the night before, not at hour zero of the hackathon

---

## 👥 Team

- Jinhee
- Phil

---

## Acknowledgments

Thanks to Seeed Studio for the hardware, FabLab Kendall for hosting, and the orange for its sacrifice.
