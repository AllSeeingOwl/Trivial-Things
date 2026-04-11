import time
import re

# Simulate 100,000 runs
text = "Some random text\n51.605582, -0.068164\nAnother line"

start = time.time()
for _ in range(100000):
    lines = text.split('\n')
    for line in lines:
        match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', line)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
end1 = time.time()

pattern = re.compile(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)')
start2 = time.time()
for _ in range(100000):
    lines = text.split('\n')
    for line in lines:
        match = pattern.search(line)
        if match:
            lat, lng = float(match.group(1)), float(match.group(2))
end2 = time.time()

print(f"Uncompiled: {end1 - start}")
print(f"Compiled: {end2 - start2}")
