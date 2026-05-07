#!/bin/sh
set -eu

mkdir -p /data/uploads
chown -R spring:spring /data/uploads

JAVA_BIN="$(command -v java)"
exec su -s /bin/sh spring -c "exec $JAVA_BIN $JAVA_OPTS -jar /app/app.jar"
