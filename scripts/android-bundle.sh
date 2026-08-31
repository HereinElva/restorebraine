#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

find_jdk21_home() {
  local candidates=(
    "${JAVA_HOME:-}"
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
    "/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home"
  )

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" && -x "$candidate/bin/java" ]] || continue
    if "$candidate/bin/java" -version 2>&1 | grep -Eq 'version "21(\.|")'; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local from_java_home
    from_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [[ -n "$from_java_home" && -x "$from_java_home/bin/java" ]]; then
      printf '%s\n' "$from_java_home"
      return 0
    fi
  fi

  return 1
}

if ! JDK21_HOME="$(find_jdk21_home)"; then
  cat <<'EOF'
ERROR: Java 21 is required for Android builds.

Install JDK 21, then retry:

  brew install openjdk@21
  sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  npm run android:bundle

Android Studio's bundled Java 25 cannot be used for this Gradle project.
EOF
  exit 1
fi

export JAVA_HOME="$JDK21_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Using Java 21 at: $JAVA_HOME"
java -version

cd android
./gradlew --stop >/dev/null 2>&1 || true
./gradlew bundleRelease

echo ""
echo "AAB output:"
echo "  android/app/build/outputs/bundle/release/app-release.aab"
