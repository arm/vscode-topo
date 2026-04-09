# ——— Configuration —————————————————————————————————————————————

COMPOSE_FILE ?= compose.topo.yaml
REMOTE_HOST  := topo.local
REMOTE_USER  := root
REMOTE       := $(REMOTE_USER)@$(REMOTE_HOST)

PROJECT := $(shell awk -F': *' '/^name:/ {print $$2; exit}' $(COMPOSE_FILE))

# ——— Targets ———————————————————————————————————————————————————

.PHONY: all check-remote check-docker build create-context transfer up

all: check-remote check-docker build create-context transfer up

# 1️⃣ Ensure the remote host is reachable

check-remote:
	@echo "🔌 Checking remote host availability_"
	@ssh -o BatchMode=yes -o ConnectTimeout=5 $(REMOTE) exit || (echo "❌ Remote host $REMOTE_HOST unreachable"; exit 1)

# 2️⃣ Verify Docker is installed on the remote

check-docker:
	@echo "🐳 Checking for Docker on remote host_"
	@ssh -o BatchMode=yes -o ConnectTimeout=5 $(REMOTE) docker version > /dev/null 2>&1 || (echo "❌ Docker CLI not found on remote host"; exit 1)

# 3️⃣ Build images locally using the default context

build:
	@echo "🏗 Building images in context 'default'_"
	@echo $(COMPOSE_DIR)
	@echo $(COMPOSE_BASE)
	@docker --context default compose -f $(COMPOSE_FILE) build

# 4️⃣ Create the 'topo' Docker context if absent

create-context:
	@echo "🔍 Checking for Docker context 'topo'…"
	@docker context ls --format '{{.Name}}' | grep -Fxq topo \
		|| (echo "➕ Creating context 'topo'" && \
			docker context create topo --docker host=ssh://$(REMOTE))

# 5️⃣ Save & load each image on the remote host

transfer:
	@echo "🚚 Saving & loading images to $(REMOTE_HOST)_"
	@for svc in $$(docker --context default compose \
			-f $(COMPOSE_FILE) config --services); do \
			image="$(PROJECT)-$$svc"; \
			echo "  • $$image → $(REMOTE_HOST)"; \
			docker --context default save "$$image" | docker --context topo load; \
	done

# 6️⃣ Start services on the remote without rebuilding

up:
	@echo "🚀 Bringing up services on the board…"
	@docker --context topo compose -f $(COMPOSE_FILE) up -d --no-build --remove-orphans
