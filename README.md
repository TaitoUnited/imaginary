# Imaginary

Imaginary is a image processing service that generates alternative versions of your images (previews, thumbnails, crops, etc.).

## Usage

### Docker Compose setup

Use the release container image on docker-compose.yaml:

```
  my-project-imaginary:
    container_name: my-project-imaginary
    image: taitounited/imaginary:1.0.0
    restart: unless-stopped
    networks:
      - default
    ports:
      - "8080"
```

Or alternatively refer directly to the imaginary implementation located on your disk:

```
  my-project-imaginary:
    container_name: my-project-imaginary
    build:
      context: ../imaginary/server
    image: taitounited/imaginary:1.0.0
    restart: unless-stopped
    networks:
      - default
    ports:
      - "8080"
```

### Imaginary API

TODO: Add description.

## Release

GitHub Actions builds and releases a new container image like so:

- `dev`: Push to dev branch.
- `latest`: Push to master branch.
- `v1.2.1`: Tag repository e.g. `taito tag v1.2.1`.
