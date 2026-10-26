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

First ensure the Day 4 files have been committed and pushed: `Server/Dockerfile.vm`, `Server/deploy/compose.vm.yml`, and `Server/deploy/.env.vm.example` must exist in the GitHub checkout. The local Day 4 changes are currently uncommitted, so cloning the existing GitHub branch now will not include them. Once they are pushed, use your repository URL if it differs from the example:

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
sudo docker compose --env-file deploy/.env.vm -f deploy/compose.vm.yml up --build -d
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
