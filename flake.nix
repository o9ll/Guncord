{
  description = "Guncord - Everything Discord doesn't build, we create";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        guncordPkg = pkgs.callPackage ./default.nix { };

        # Wraps official Discord binaries with Guncord desktop patcher
        wrapDiscord = discordPkg: pkgs.runCommand "${discordPkg.name}-guncord" {
          nativeBuildInputs = [ pkgs.makeWrapper ];
          meta = discordPkg.meta // {
            description = "${discordPkg.meta.description or "Discord"} (with Guncord mod)";
            mainProgram = discordPkg.meta.mainProgram or "discord";
          };
        } ''
          mkdir -p $out
          cp -rs --no-preserve=mode,ownership ${discordPkg}/* $out/

          for res in $out/opt/*/resources $out/share/*/resources $out/opt/discord*/resources $out/lib/*/resources; do
            if [ -d "$res" ]; then
              rm -rf "$res/app"
              mkdir -p "$res/app"
              cat << 'EOF' > "$res/app/package.json"
{
  "name": "discord",
  "main": "index.js"
}
EOF
              echo 'require("${guncordPkg}/share/guncord/patcher.js");' > "$res/app/index.js"
            fi
          done
        '';
      in rec {
        packages = {
          # The core Guncord compiled desktop JS/CSS files
          guncord = guncordPkg;

          # Pre-wrapped Discord clients
          discord-guncord = wrapDiscord pkgs.discord;
          discord-ptb-guncord = wrapDiscord pkgs.discord-ptb;
          discord-canary-guncord = wrapDiscord pkgs.discord-canary;

          # Default runnable package
          default = packages.discord-guncord;
        };

        apps = rec {
          default = discord;
          discord = flake-utils.lib.mkApp {
            drv = packages.discord-guncord;
          };
          discord-ptb = flake-utils.lib.mkApp {
            drv = packages.discord-ptb-guncord;
          };
          discord-canary = flake-utils.lib.mkApp {
            drv = packages.discord-canary-guncord;
          };
        };
      }
    ) // {
      overlays.default = final: prev: {
        guncord = final.callPackage ./default.nix { };

        discord-guncord = final.runCommand "discord-guncord" {
          nativeBuildInputs = [ final.makeWrapper ];
        } ''
          mkdir -p $out
          cp -rs --no-preserve=mode,ownership ${final.discord}/* $out/
          for res in $out/opt/*/resources $out/share/*/resources $out/opt/discord*/resources $out/lib/*/resources; do
            if [ -d "$res" ]; then
              rm -rf "$res/app"
              mkdir -p "$res/app"
              echo '{"name":"discord","main":"index.js"}' > "$res/app/package.json"
              echo 'require("${final.guncord}/share/guncord/patcher.js");' > "$res/app/index.js"
            fi
          done
        '';

        # Default discord package override
        discord = final.discord-guncord;
      };

      nixosModules.default = { config, lib, pkgs, ... }:
        let
          cfg = config.programs.guncord;
        in {
          options.programs.guncord = {
            enable = lib.mkEnableOption "Guncord Discord client mod";
            channel = lib.mkOption {
              type = lib.types.enum [ "stable" "ptb" "canary" ];
              default = "stable";
              description = "The Discord release channel to use with Guncord.";
            };
            package = lib.mkOption {
              type = lib.types.package;
              default =
                if cfg.channel == "canary" then self.packages.${pkgs.system}.discord-canary-guncord
                else if cfg.channel == "ptb" then self.packages.${pkgs.system}.discord-ptb-guncord
                else self.packages.${pkgs.system}.discord-guncord;
              description = "The Guncord-wrapped Discord package to install.";
            };
          };

          config = lib.mkIf cfg.enable {
            environment.systemPackages = [ cfg.package ];
          };
        };

      homeManagerModules.default = { config, lib, pkgs, ... }:
        let
          cfg = config.programs.guncord;
        in {
          options.programs.guncord = {
            enable = lib.mkEnableOption "Guncord Discord client mod";
            channel = lib.mkOption {
              type = lib.types.enum [ "stable" "ptb" "canary" ];
              default = "stable";
              description = "The Discord release channel to use with Guncord.";
            };
            package = lib.mkOption {
              type = lib.types.package;
              default =
                if cfg.channel == "canary" then self.packages.${pkgs.system}.discord-canary-guncord
                else if cfg.channel == "ptb" then self.packages.${pkgs.system}.discord-ptb-guncord
                else self.packages.${pkgs.system}.discord-guncord;
              description = "The Guncord-wrapped Discord package to install.";
            };
          };

          config = lib.mkIf cfg.enable {
            home.packages = [ cfg.package ];
          };
        };
    };
}

