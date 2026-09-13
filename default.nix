{ lib
, stdenv
, nodejs_20
, pnpm ? null
}:

stdenv.mkDerivation rec {
  pname = "guncord";
  version = "1.27.8";

  src = lib.cleanSource ./.;

  nativeBuildInputs = [
    nodejs_20
  ] ++ lib.optional (pnpm != null) pnpm.configHook;

  buildPhase = ''
    runHook preBuild
    if [ -d "dist/desktop" ] && [ -f "dist/desktop/patcher.js" ]; then
      echo "Guncord: Using pre-compiled dist/desktop build."
    else
      echo "Guncord: Building dist files..."
      node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs || true
    fi
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/guncord
    if [ -d "dist/desktop" ]; then
      cp -r dist/desktop/* $out/share/guncord/
    elif [ -d "dist" ]; then
      cp -r dist/* $out/share/guncord/
    fi
    runHook postInstall
  '';

  meta = with lib; {
    description = "Everything Discord doesn't build, we create (Guncord)";
    homepage = "https://github.com/o9ll/Guncord";
    license = licenses.gpl3Plus;
    platforms = platforms.all;
  };
}

