import subprocess, time, os, shutil

os.makedirs('/home/yang/Project/PipFinance/certificates/previews', exist_ok=True)
artifact_dir = '/home/yang/.gemini/antigravity/brain/cf646bc6-1726-4ab5-baff-adffe22d53e2'

http_proc = subprocess.Popen(['python3', '-m', 'http.server', '8890', '--directory', '/home/yang/Project/PipFinance/certificates'])
time.sleep(1.2)

try:
    for i in range(1, 11):
        out_png = f'/home/yang/Project/PipFinance/certificates/previews/typo_{i}.png'
        url = f'http://localhost:8890/index.html?standalone=true&typo={i}'
        cmd = [
            'chromium',
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--window-size=1120,792',
            '--virtual-time-budget=2000',
            f'--screenshot={out_png}',
            url
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(out_png):
            shutil.copy(out_png, os.path.join(artifact_dir, f'typo_{i}.png'))
            print(f'Rendered Typo {i}: {os.path.getsize(out_png)} bytes')
        else:
            print(f'Failed Typo {i}: {res.stderr}')
finally:
    http_proc.terminate()

print('All 10 typography presets rendered!')
