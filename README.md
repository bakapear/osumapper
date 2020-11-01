# osumapper
Fork of: https://github.com/kotritrona/osumapper/

Uses some tensorflow machine learning magic to create AI-generated beatmaps for osu!<br>
I changed this a bit so it doesn't use jupyter notebooks and you can run it off batch files!

## Requirements
- [NodeJS](https://nodejs.org/en/)
- [Anaconda3](https://www.anaconda.com/products/individual)

## Installation
1. [Download this repository](https://github.com/bakapear/osumapper/archive/master.zip) and extract it somewhere.
2. Open Anaconda Prompt as Administrator and run `v7.0/install.bat`.

## Usage
#### Generating a beatmap
Drag a `.mp3` or `.osz` file onto `generate.bat` to generate a beatmap.<br>
If you include a valid path in `path.txt`, then the generated beatmaps will be moved to that path.<br>
You can use different pre-trained models located in `v7.0/models` by changing `model.txt` before generating.

#### Training your own model
Put a list of maps into a text file and drag it on `feed.bat` to start training a model.<br>
Resulting files (`flow_dataset.npz` & `rhythm_model`) are located in `v7.0/model`.

To add your model to the model list, put the resulting files in `v7.0/models/<my_cool_model>`.<br>
Then copy over the `config.json` file you can find in the other model folders and change the parameters to your liking.
