# -*- coding: utf-8 -*-

#
# Part 5 action script
#

from audio_tools import *

import os
import re
import time

mapdata_path = "mapdata/"


def step4_read_new_map(file_path, divisor=4):
    # Test paths and node
    test_process_path("node")

    start = time.time()
    read_and_save_osu_tester_file(
        file_path.strip(), filename="temp/mapthis", divisor=divisor)
    end = time.time()
