#!/bin/sh
set -eu
umask 077
exec 9>/var/backups/fable/backup.lock
flock -n 9 || exit 0
archive="/var/backups/fable/media-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
# Objects are immutable; database reachability determines later reclamation.
tar --create --gzip --file="${archive}.partial" --directory=/var/lib/fable media
mv -- "${archive}.partial" "$archive"
printf '%s\n' 'Private media backup saved. Copy backups off this host for disaster recovery.'
