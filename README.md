# API DevOps — laboratório

API de tarefas em Node.js 24, Express 5 e TypeScript. SQLite persiste em volume Docker. Porta padrão **18473**, alterável sem recompilar a imagem.

## 1. Desenvolvimento local

Instale Node.js 24 LTS e npm. Na pasta do projeto:

```bash
npm install
npm test
npm run build
npm start
# ou, para desenvolvimento:
npm run dev
```

Variáveis do processo: `PORT` (18473) e `DATABASE_PATH` (`./data/tasks.sqlite`). O diretório é criado automaticamente. Não execute duas instâncias compartilhando este arquivo.

## 2. Publicar no GitHub e GHCR

Crie um repositório no GitHub, envie estes arquivos e use a branch `main`. Na aba Actions, habilite workflows, se solicitado. O workflow executa testes e compilação antes de publicar. Pull requests só validam. O nome da imagem será `ghcr.io/usuario/repositorio`, em minúsculas.

A autenticação da publicação usa `GITHUB_TOKEN`, fornecido automaticamente pelo GitHub; não adicione tokens ao código. Nas configurações do pacote GHCR, escolha visibilidade pública para permitir pull anônimo. Se sua organização restringe criação de pacotes, ajuste as permissões com o administrador.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Isso publica a tag `1.0.0`. Pushes em main publicam `latest`; cada publicação também recebe `sha-<commit curto>`. Prefira versões fixas na VPS. A imagem suporta amd64 e arm64.

Para pacotes privados, use na VPS um token clássico com `read:packages` e acesso ao pacote (autorize SSO se necessário):

```bash
read -rsp 'Token GHCR: ' GHCR_TOKEN; echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
unset GHCR_TOKEN
```

## 3. Preparar a VPS Ubuntu/Debian

Se Coolify já instalou Docker, aproveite a instalação:

```bash
docker --version
docker compose version
sudo systemctl status docker
```

Somente se Docker não existir, siga o repositório oficial para [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) ou [Debian](https://docs.docker.com/engine/install/debian/), incluindo o plugin Compose. Não reinstale o Docker de uma VPS com Coolify ativo. Use `sudo docker` caso seu usuário não tenha acesso ao daemon.

Confira portas antes de configurar:

```bash
sudo ss -ltnp | rg ':18473\b'
# Se rg não existir: sudo ss -ltnp | grep ':18473 '
```

Se houver saída indicando uso, escolha outra porta, por exemplo 19473. Não altere portas dos serviços existentes.

## 4. Deploy da imagem

Copie `compose.yaml` e `.env.example` para uma pasta dedicada na VPS (não é necessário copiar código nem instalar Node).

```bash
mkdir -p ~/api-devops-exemplo
cd ~/api-devops-exemplo
# Copie os dois arquivos para esta pasta via scp ou git clone.
cp .env.example .env
nano .env
```

Configure com seu usuário e repositório em minúsculas:

```dotenv
IMAGE=ghcr.io/seu-usuario/api-devops-exemplo:1.0.0
HOST_PORT=18473
BIND_ADDRESS=0.0.0.0
```

```bash
docker compose config
docker compose pull
docker compose up -d --wait
docker compose ps
curl -f http://127.0.0.1:18473/health
docker compose logs --tail=100 -f api
```

Acesse `http://IP_DA_VPS:18473`. Autorize TCP nessa porta no firewall do provedor apenas para a origem desejada. Portas publicadas pelo Docker podem contornar regras UFW; não dependa apenas dele para restringir acesso. Para acesso somente local, configure `BIND_ADDRESS=127.0.0.1`.

A API é um laboratório sem autenticação: qualquer pessoa com acesso pode alterar as tarefas.

## 5. Usar com Coolify

O Compose tem rede e volume próprios, sem nomes fixos de contêiner, e não precisa ocupar 80/443. Para domínio e HTTPS, você pode criar um recurso Docker Image no Coolify com a mesma imagem, porta interna 18473 e volume persistente em `/app/data`, associando seu domínio e configurando DNS para a VPS. Nesse modo o Coolify gerencia o proxy e o certificado; não é necessário publicar 18473 no host. Use apenas um dos modos de deploy por conjunto de dados. O volume do Compose não é transferido automaticamente ao recurso Coolify.

## 6. Testar os endpoints

```bash
BASE=http://localhost:18473
curl "$BASE/"
curl "$BASE/health"
curl -i -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d '{"title":"Aprender Docker"}'
curl "$BASE/api/tasks"
# Substitua ID pelo UUID recebido na criação:
curl "$BASE/api/tasks/ID"
curl -X PATCH "$BASE/api/tasks/ID" -H 'Content-Type: application/json' -d '{"completed":true}'
curl -i -X DELETE "$BASE/api/tasks/ID"
```

Tarefa: `id`, `title`, `completed`, `createdAt`, `updatedAt`. Título obrigatório, sem espaços vazios, até 200 caracteres; completed é booleano, inicialmente false. PATCH aceita título e/ou completed. Criação retorna 201, consultas/atualização 200, exclusão 204, entradas inválidas 400, corpo grande 413, recurso inexistente 404 e falhas internas 500. Datas são UTC ISO 8601.

## 7. Atualização e rollback

Edite `IMAGE` no `.env` para a nova versão:

```bash
docker compose pull
docker compose up -d --wait
curl -f http://localhost:18473/health
```

Para rollback, restaure a tag anterior e repita. Os dados permanecem no volume. Este exemplo não altera o esquema entre versões; futuras migrações exigem avaliar compatibilidade antes de voltar a imagem.

```bash
docker compose restart api
docker compose down
# down preserva dados; down -v apaga o volume e todas as tarefas.
```

## 8. Backup e restauração

Execute na mesma pasta do Compose. Pare a aplicação para obter uma cópia consistente:

```bash
mkdir -p backups
docker compose stop api
docker compose cp api:/app/data/tasks.sqlite ./backups/tasks.sqlite
docker compose start api
```

Copie o backup para outro local seguro. Para restaurar em um contêiner existente, após guardar os dados atuais:

```bash
docker compose stop api
docker compose cp ./backups/tasks.sqlite api:/app/data/tasks.sqlite
docker compose run --rm --user root --entrypoint chown api node:node /app/data/tasks.sqlite
docker compose start api
```

## 9. Conceitos para explorar em aula

- Dockerfile gera a imagem; o contêiner é uma execução dela. O build possui estágios separados e o runtime usa usuário sem privilégios.
- GHCR armazena imagens. GitHub Actions demonstra integração contínua e entrega da imagem; o deploy é manual.
- O volume mantém o SQLite quando o contêiner é recriado. Demonstre `up -d --force-recreate` e consulte a tarefa novamente.
- O mapeamento de portas separa host e contêiner. `.env` muda configuração sem mudar código.
- Healthcheck indica saúde; não reinicia automaticamente um contêiner unhealthy. A política de reinício trata término do processo.
- Logs saem em stdout. SIGTERM permite concluir requisições e fechar o banco antes de encerrar.

## Verificação e limitações deste ambiente

A instalação de dependências ficou bloqueada por DNS (`EAI_AGAIN` no registry npm), e o daemon Docker negou acesso. Portanto testes, compilação e smoke test Docker ainda precisam ser executados em ambiente com esses acessos. Como não foi possível gerar lockfile, o projeto usa `npm install`; após instalar, versione `package-lock.json` e substitua por `npm ci` no Dockerfile e workflow para builds reprodutíveis.
