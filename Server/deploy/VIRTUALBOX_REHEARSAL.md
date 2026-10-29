# VirtualBox setup: run TurfBookPK on your laptop

This is a **practice server** inside your laptop. It uses a separate test database and mock payments. You do not need Clink, SMS, Cloudinary, or a rented VPS for this first run.

## 1. Create the Ubuntu VM

1. Install [VirtualBox](https://www.virtualbox.org/wiki/Downloads) and download the [Ubuntu Server 24.04 LTS ISO](https://ubuntu.com/download/server).
2. In VirtualBox, click **New**. Name it `TurfBookPK-Test`, select the Ubuntu ISO, and give it **2 CPUs, 4 GB RAM, and a 30 GB disk**. Keep the network adapter on **NAT**.
3. Start the VM and install Ubuntu. Create a username/password you can remember. If the installer offers **Install OpenSSH server**, select it. If it does not, install it from the terminal in step 3. After installation, reboot and log in.

If VirtualBox skips the Ubuntu setup wizard, open the VM's **Settings → Storage**, attach the ISO to the optical drive, then start it again.

## 2. Let your laptop reach the VM

Shut down the VM. In VirtualBox open **Settings → Network → Adapter 1 → Advanced → Port Forwarding**. Add these two rules, then start the VM again:

| Name | Host IP | Host port | Guest IP | Guest port |
| --- | --- | ---: | --- | ---: |
| SSH | `127.0.0.1` | `2222` | leave blank | `22` |
| API | `127.0.0.1` | `5500` | leave blank | `5000` |

This lets Windows open the VM API at `http://127.0.0.1:5500`. The Windows port is `5500`; inside the VM it is `5000`.

## 3. Install the tools inside Ubuntu

Type these commands in the Ubuntu VM terminal:

```bash
sudo apt update
sudo apt install -y git curl openssh-server
sudo systemctl enable --now ssh
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo docker compose version
```

The Docker install script is convenient for a disposable practice VM. For a real VPS, use Docker's [Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/).

## 4. Start the app

The Day 4 VM files are on `main`. Use your repository URL if it differs from the example:

```bash
git clone https://github.com/vaas2k/TurfBookPk.git
cd TurfBookPk/Server
cp deploy/.env.vm.example deploy/.env.vm
nano deploy/.env.vm
```

In `nano`, replace the sample password and secret values with your **own test-only values**. For `REHEARSAL_DB_PASSWORD`, use letters and numbers only. Press **Ctrl+O**, **Enter**, then **Ctrl+X** to save and exit. Do not put real payment credentials in this file.

For the VirtualBox NAT forwarding rule in step 2, also add `REHEARSAL_BIND_IP=0.0.0.0` on a new line in this VM-only file. Local Docker testing on your laptop can keep the safer default `127.0.0.1`.

Then run:

```bash

sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml ps
curl http://127.0.0.1:5000/api/ready
```

The first build can take several minutes. A successful readiness check returns JSON with an OK/ready result. The `migrate` container may show `Exited (0)`; that means the one-time database migration finished.

On **Windows PowerShell**, check the forwarded address:

```powershell
curl.exe http://127.0.0.1:5500/api/ready
```

## If it does not start

In the Ubuntu VM, inspect the last log lines:

```bash
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml ps
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml logs --tail=80 api migrate db redis worker
```

If `git clone` says the repository is private, clone with your own GitHub access method or copy the project into the VM. If Windows cannot reach port `5500`, recheck both VirtualBox port-forwarding rules and the API container status.

To stop the app without deleting its database:

```bash
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml down
```

When this basic setup works, continue with [the Day 3 scaling checks](ADVANCED_VM_CHECKS.md). This NAT setup serves your laptop; a physical phone needs a separate LAN or bridged-network setup.

## 6. Run an isolated full-path load test

This test uses a separate `turfbookpk_loadtest` database. It does not add fake
users, grounds, or bookings to the normal rehearsal database. Requests follow
the real path: Nginx -> two API replicas -> PgBouncer -> PostgreSQL.

Set a short command alias first:

```bash
cd ~/TurfBookPk/Server
files="-f deploy/compose.vm.yml -f deploy/compose.ha-rehearsal.yml -f deploy/compose.pgbouncer-rehearsal.yml -f deploy/compose.loadtest-rehearsal.yml"
```

Create the isolated database, apply migrations, and add the small VM dataset:

```bash
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml exec -T db \
  createdb -U turfbookpk turfbookpk_loadtest
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools \
  run --rm loadtest-migrate
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools \
  run --rm loadtest-seed
```

If `createdb` reports that the database already exists, continue; the guarded
seed is repeatable. Now temporarily point the APIs and PgBouncer at that data:

```bash
sudo docker compose --env-file deploy/.env.vm $files up -d pgbouncer api api-replica api-proxy
curl http://127.0.0.1:5080/api/ready
```

Run 30 concurrent read clients for 30 seconds:

```bash
sudo docker compose --env-file deploy/.env.vm $files --profile loadtest-tools \
  run --rm loadtest-benchmark
```

Restore the APIs to the ordinary rehearsal database afterward:

```bash
base_files="-f deploy/compose.vm.yml -f deploy/compose.ha-rehearsal.yml -f deploy/compose.pgbouncer-rehearsal.yml"
sudo docker compose --env-file deploy/.env.vm $base_files up -d --force-recreate pgbouncer api api-replica api-proxy
curl http://127.0.0.1:5080/api/ready
```

The load-test database is intentionally retained for repeatable measurements.
Do not drop it until the load-test work is complete.

## 7. Generate load from Windows

This keeps the load generator off the two-CPU VM. The Windows script uses the
same seven read routes and temporary synthetic users as the container test.
Keep the SSH tunnel from Windows port 5080 to VM port 5080 open throughout.

In **Ubuntu**, update and build the server image, then point the two APIs at
the isolated load-test database:

```bash
cd ~/TurfBookPk/Server
git pull --ff-only
files="-f deploy/compose.vm.yml -f deploy/compose.ha-rehearsal.yml -f deploy/compose.pgbouncer-rehearsal.yml -f deploy/compose.loadtest-rehearsal.yml"
sudo docker compose --env-file deploy/.env.vm $files build migrate
sudo docker compose --env-file deploy/.env.vm $files up -d --force-recreate pgbouncer api api-replica api-proxy
curl -f http://127.0.0.1:5080/api/ready
```

Create a private fixture file with two temporary login sessions:

```bash
umask 077
sudo docker exec turfbookpk-vm-api-1 \
  node /app/scripts/benchmark-external-fixture.mjs prepare \
  > backups/external-benchmark-fixture.json
```

On **Windows PowerShell**, from the repository root, copy the fixture and run
the benchmark while the SSH tunnel stays open:

```powershell
scp.exe -P 2222 turfbookpk@127.0.0.1:~/TurfBookPk/Server/backups/external-benchmark-fixture.json .\Server\external-benchmark-fixture.json
cd Server
node scripts/benchmark-scalability.mjs --fixture=external-benchmark-fixture.json --vus=30 --seconds=30
node scripts/benchmark-scalability.mjs --fixture=external-benchmark-fixture.json --vus=60 --seconds=30
```

Each run waits 45 seconds after reporting so old upstream requests can drain.
The fixture expires after 45 minutes. To remove the two temporary sessions
immediately, read only its run ID on Windows:

```powershell
(Get-Content .\external-benchmark-fixture.json | ConvertFrom-Json).run_id
```

Back in **Ubuntu**, replace `RUN_ID` with that value:

```bash
sudo docker exec turfbookpk-vm-api-1 \
  node /app/scripts/benchmark-external-fixture.mjs cleanup RUN_ID
```

Then restore the normal rehearsal database with the `base_files` command in
the preceding section. The fixture files contain short-lived test bearer
tokens; they are ignored by Git and should not be pasted into chat.
