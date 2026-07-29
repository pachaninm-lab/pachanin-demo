from pathlib import Path

path = Path('.github/workflows/tai-restricted-qwen-reg-ru-activation.yml')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        """          model_key=\"${MODEL_KEY_SECRET:-${PROD_KEY_PRIMARY:-${PROD_KEY_SECONDARY:-${PROD_KEY_FALLBACK:-}}}}\"
          prod_key=\"${PROD_KEY_PRIMARY:-${PROD_KEY_SECONDARY:-${PROD_KEY_FALLBACK:-}}}\"
          write_key \"$model_key\" \"$HOME/.ssh/id_tai_model\" || { echo 'Protected model-host private key is unavailable.' >&2; exit 10; }
          write_key \"$prod_key\" \"$HOME/.ssh/id_pc_prod\" || { echo 'Protected production private key is unavailable.' >&2; exit 11; }
""",
        """          model_key=\"${MODEL_KEY_SECRET:-${PROD_KEY_PRIMARY:-${PROD_KEY_SECONDARY:-${PROD_KEY_FALLBACK:-}}}}\"
          model_password=\"${MODEL_PASSWORD_SECRET:-}\"
          prod_key=\"${PROD_KEY_PRIMARY:-${PROD_KEY_SECONDARY:-${PROD_KEY_FALLBACK:-}}}\"
          model_mode=''
          if [[ -n \"$model_key\" ]] && write_key \"$model_key\" \"$HOME/.ssh/id_tai_model\"; then
            model_mode='key'
          elif [[ -n \"$model_password\" ]]; then
            sudo apt-get update -qq
            sudo apt-get install -y -qq sshpass
            model_mode='password'
          else
            echo 'Protected model-host SSH credential is unavailable.' >&2
            exit 10
          fi
          write_key \"$prod_key\" \"$HOME/.ssh/id_pc_prod\" || { echo 'Protected production private key is unavailable.' >&2; exit 11; }
""",
    ),
    (
        """            echo \"model_host=$model_host\"
            echo \"model_user=$model_user\"
            echo \"model_port=$model_port\"
            echo \"prod_host=$prod_host\"
""",
        """            echo \"model_host=$model_host\"
            echo \"model_user=$model_user\"
            echo \"model_port=$model_port\"
            echo \"model_mode=$model_mode\"
            echo \"prod_host=$prod_host\"
""",
    ),
    (
        """          MODEL_HOST: ${{ steps.ssh.outputs.model_host }}
          MODEL_USER: ${{ steps.ssh.outputs.model_user }}
          MODEL_SSH_PORT: ${{ steps.ssh.outputs.model_port }}
""",
        """          MODEL_HOST: ${{ steps.ssh.outputs.model_host }}
          MODEL_USER: ${{ steps.ssh.outputs.model_user }}
          MODEL_SSH_PORT: ${{ steps.ssh.outputs.model_port }}
          MODEL_SSH_MODE: ${{ steps.ssh.outputs.model_mode }}
          MODEL_SSH_PASSWORD: ${{ secrets.TAI_MODEL_SSH_PASSWORD }}
""",
    ),
    (
        """          api_key=\"$(ssh -i \"$HOME/.ssh/id_tai_model\" -p \"$MODEL_SSH_PORT\" -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=\"$HOME/.ssh/model_known_hosts\" -o StrictHostKeyChecking=yes \"$MODEL_USER@$MODEL_HOST\" \"$remote\")\"
""",
        """          if [[ \"$MODEL_SSH_MODE\" == key ]]; then
            api_key=\"$(ssh -i \"$HOME/.ssh/id_tai_model\" -p \"$MODEL_SSH_PORT\" -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=\"$HOME/.ssh/model_known_hosts\" -o StrictHostKeyChecking=yes \"$MODEL_USER@$MODEL_HOST\" \"$remote\")\"
          elif [[ \"$MODEL_SSH_MODE\" == password ]]; then
            [[ -n \"$MODEL_SSH_PASSWORD\" ]]
            api_key=\"$(SSHPASS=\"$MODEL_SSH_PASSWORD\" sshpass -e ssh -p \"$MODEL_SSH_PORT\" -o PubkeyAuthentication=no -o PreferredAuthentications=password -o UserKnownHostsFile=\"$HOME/.ssh/model_known_hosts\" -o StrictHostKeyChecking=yes \"$MODEL_USER@$MODEL_HOST\" \"$remote\")\"
          else
            echo 'Unknown protected model-host SSH mode.' >&2
            exit 12
          fi
""",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one exact replacement, found {count}')
    text = text.replace(old, new)

path.write_text(text, encoding='utf-8')
