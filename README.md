# Imaginary

Imaginary is a image processing service that generates alternative versions of your images (previews, thumbnails, crops, etc.).

## Usage

### Docker Compose setup

Use the release container image on docker-compose.yaml:

```
  my-project-imaginary:
    container_name: my-project-imaginary
    image: ghcr.io/taitounited/imaginary:latest
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
    restart: unless-stopped
    networks:
      - default
    ports:
      - "8080"
```

### Imaginary API

Automatically generated API description is available at [https://taito-imaginary-dev.taitodev.com/docs]().

Example
```json
{
	"pipeline": [
		{
			"op": "resize",
			"args": {
				"width": 1024,
				"height": 1024,
				"kernel": "nearest",
				"fit": "contain"
			}
		}
	],
	"urls": [
		{
			"input": "https://cdn.pixabay.com/photo/2013/07/12/17/47/test-pattern-152459_960_720.png",
			"output": {
				"url": "https://webhook.site/22ef5a04-f61d-4b37-85e6-0806fc6e3548",
				"method": "PUT",
				"headers": {
					"Content-Length": "{{OUTPUT_LENGTH}}"
				}
			}
		}
	]
}
```

This will download the image from the input url (`"https://cdn.pixabay.com/photo/2013/07/12/17/47/test-pattern-152459_960_720.png"`), resize it, and
upload the result to the specified output url (`"https://webhook.site/22ef5a04-f61d-4b37-85e6-0806fc6e3548"`).

In this example, the `Content-Length` -header is populated with the size of the output image.

## Release

GitHub Actions builds and releases a new container image like so:

- `dev`: Push to dev branch.
- `latest`: Push to master branch.
- `v1.2.1`: Tag repository e.g. `taito tag v1.2.1`.
