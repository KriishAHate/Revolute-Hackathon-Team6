# Merge train and validation splits back into one dataset
lerobot-edit-dataset \
    --operation.type merge \
    --operation.output_dir merged/ \
    --operation.repo_ids "['seeed_rebot_b601_rs/lychee-fixed-10', 'seeed_rebot_b601_rs/orange-fixed-50']"
