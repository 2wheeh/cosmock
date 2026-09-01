# xplad image for starskiff test instances.
#
# XPLA publishes static linux/amd64 and linux/arm64 binaries as GitHub release
# assets. Its v1.12.0 GHCR workflow could not fetch the release's private EVM
# dependency, so starskiff wraps those official binaries instead of rebuilding
# source or retaining a vulnerable pre-hotfix image.
ARG RUNTIME_BASE=gcr.io/distroless/base-debian12:nonroot

FROM alpine:3.22 AS fetcher

ARG REPO=xpladev/xpla
ARG REF
ARG COMMIT
ARG TARGETARCH

RUN test -n "${REF}" || (echo "REF build-arg is required" >&2; exit 1)
RUN test -n "${COMMIT}" || (echo "COMMIT build-arg is required" >&2; exit 1)

RUN apk add --no-cache git \
    && git clone --depth 1 --branch "${REF}" "https://github.com/${REPO}.git" /src \
    && actual="$(git -C /src rev-parse HEAD)" \
    && if [ "${actual}" != "${COMMIT}" ]; then \
         echo "commit mismatch: tag ${REF} is ${actual}, expected ${COMMIT}" >&2; exit 1; \
       fi \
    && rm -rf /src

# These are the digests GitHub records on the official v1.12.0 release assets.
# A new release must update both values deliberately; an asset replacement or
# corrupt download fails closed.
ARG XPLAD_AMD64_SHA256=fe4864c00815cf84e98873345bd83a0fd3ed22330db6e10d5b4c21d380eab1ee
ARG XPLAD_ARM64_SHA256=dec981fbe883651aca8bc31e9be987724b2b49a30d7e0696bea19deef582d3c1

RUN case "${TARGETARCH}" in \
      amd64) asset_arch=x86_64; expected="${XPLAD_AMD64_SHA256}" ;; \
      arm64) asset_arch=arm64; expected="${XPLAD_ARM64_SHA256}" ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && asset="xpla_${REF}_Linux_${asset_arch}.tar.gz" \
    && wget -q "https://github.com/${REPO}/releases/download/${REF}/${asset}" -O /tmp/xplad.tar.gz \
    && echo "${expected}  /tmp/xplad.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/xplad.tar.gz -C /usr/local/bin xplad \
    && chmod 0755 /usr/local/bin/xplad

FROM ${RUNTIME_BASE}
COPY --from=fetcher /usr/local/bin/xplad /usr/bin/xplad
# No entrypoint: starskiff invokes `docker run IMAGE xplad <args>`.
