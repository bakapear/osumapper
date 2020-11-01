import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import sys
from act_flow_ds import *
from act_train_rhythm import *
from act_data_prep import *
import json


f = sys.argv[1]

step1_load_maps(f)

train_params_p2 = {
    "divisor": 4,
    "train_epochs": 16,
    "train_batch_size": None,
    "plot_history": True,
    "too_many_maps_threshold": 200,
    "train_epochs_many_maps": 6,
    "data_split_count": 80
}

model_p2 = step2_build_model()

model_p2 = step2_train_model(model_p2, train_params_p2)
step2_evaluate(model_p2)

step2_save("model/rhythm_model", model_p2)

flow_dataset_params = step3_set_params(note_group_size=10, step_size=5)
maps_flow = step3_read_maps_flow(flow_dataset_params)
step3_save_flow_dataset("model/flow_dataset", maps_flow)
