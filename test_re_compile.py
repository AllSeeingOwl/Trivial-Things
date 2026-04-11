import re
import time

# Create 100,000 runs of compile vs precompiled

start1 = time.time()
for _ in range(1000000):
    match = re.search(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)', "1.23, 4.56")
end1 = time.time()

pattern = re.compile(r'(-?\d+\.\d+),\s*(-?\d+\.\d+)')
start2 = time.time()
for _ in range(1000000):
    match = pattern.search("1.23, 4.56")
end2 = time.time()

print(f"Uncompiled: {end1 - start1}")
print(f"Compiled: {end2 - start2}")
