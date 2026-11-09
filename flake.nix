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

        guncordPkg = pkgs.callPackage ./default.nix {
          src = self;
          gitHash = self.rev or "unknown";
        };

        # Injects Guncord desktop patcher into Discord by overriding unwrappedDiscord
        wrapDiscord = discordPkg:
          if discordPkg ? unwrappedDiscord then
            discordPkg.override {
              unwrappedDiscord = discordPkg.unwrappedDiscord.overrideAttrs (old: {
                postInstall = (old.postInstall or "") + ''
                  if [ -f "$out/opt/Discord/resources/app.asar" ]; then
                    mv $out/opt/Discord/resources/app.asar $out/opt/Discord/resources/_app.asar
                    mkdir $out/opt/Discord/resources/app.asar
                    echo '{"name":"discord","main":"index.js"}' > $out/opt/Discord/resources/app.asar/package.json
                    echo 'require("${guncordPkg}/share/guncord/patcher.js")' > $out/opt/Discord/resources/app.asar/index.js
                  else
                    for asar in $out/opt/*/resources/app.asar; do
                      if [ -f "$asar" ]; then
                        dir="$(dirname "$asar")"
                        mv "$asar" "$dir/_app.asar"
                        mkdir -p "$asar"
                        echo '{"name":"discord","main":"index.js"}' > "$asar/package.json"
                        echo 'require("${guncordPkg}/share/guncord/patcher.js")' > "$asar/index.js"
                      fi
                    done
                  fi
                '';
              });
            }
          else
            # Fallback for non-FHS Discord derivations (e.g. Darwin or standalone)
            discordPkg.overrideAttrs (old: {
              postInstall = (old.postInstall or "") + ''
                for asar in $out/opt/*/resources/app.asar $out/Applications/*/Contents/Resources/app.asar; do
                  if [ -f "$asar" ]; then
                    dir="$(dirname "$asar")"
                    mv "$asar" "$dir/_app.asar"
                    mkdir -p "$asar"
                    echo '{"name":"discord","main":"index.js"}' > "$asar/package.json"
                    echo 'require("${guncordPkg}/share/guncord/patcher.js")' > "$asar/index.js"
                  fi
                done
              '';
            });
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
        guncord = final.callPackage ./default.nix {
          src = self;
          gitHash = self.rev or "unknown";
        };

        discord-guncord = final.discord.override {
          unwrappedDiscord = final.discord.unwrappedDiscord.overrideAttrs (old: {
            postInstall = (old.postInstall or "") + ''
              mv $out/opt/Discord/resources/app.asar $out/opt/Discord/resources/_app.asar
              mkdir $out/opt/Discord/resources/app.asar
              echo '{"name":"discord","main":"index.js"}' > $out/opt/Discord/resources/app.asar/package.json
              echo 'require("${final.guncord}/share/guncord/patcher.js")' > $out/opt/Discord/resources/app.asar/index.js
            '';
          });
        };

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

