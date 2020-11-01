import sys
import os
from act_newmap_prep import *
from act_rhythm_calc import *
from act_gan import *
from act_modding import *
from act_final import *
from act_timing import *

f = sys.argv[1]

file_path = f if f.endswith('.osu') else get_timed_osu_file(f, game_mode=0)

select_model = 'models/' + open('../model.txt').read()
model_params = json.load(open(select_model + '/config.json'))

step4_read_new_map(file_path)

model_file = select_model + "/rhythm_model"
if not os.path.exists(model_file):
    model_file = "model/rhythm_model"

model = step5_load_model(model_file)
npz = step5_load_npz()

rhythm_params = model_params['rhythm']

params = step5_set_params(
    rhythm_params['dist_multiplier'],
    rhythm_params['note_density'],
    rhythm_params['slider_favor'],
    rhythm_params['divisor_favor'],
    rhythm_params['slider_max_ticks']
)

predictions = step5_predict_notes(model, npz, params)
converted = step5_convert_sliders(predictions, params)

step5_save_predictions(converted)

gan_params = model_params['gan']

step6_set_gan_params(gan_params)

flow_file = select_model + "/flow_dataset.npz"
if not os.path.exists(flow_file):
    flow_file = "model/flow_dataset.npz"
osu_a, data = step6_run_all(flow_file)

modding_params = model_params['modding']

osu_a, data = step7_modding(osu_a, data, modding_params)

saved_osu_name = step8_save_osu_file(osu_a, data)

step8_clean_up()
