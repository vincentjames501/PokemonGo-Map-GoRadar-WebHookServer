# PokemonGo-Map-GoRadar-WebHookServer

A *very* simple node server with *no dependencies* which can receive 
webhook requests from [PokemonGoMap](https://github.com/PokemonGoMap/PokemonGo-Map). 
 
## Prerequisites
 
Simply install [Node.js](https://nodejs.org/en/download/)
 
## Usage

### Starting the server

```bash
Usage: node server.js [--verbose] [--port PORT]

Options
  --port PORT, -p PORT          What port the server should run on. Default: 8080
  --verbose, -v                 Verbose logging enabled. Default: false
```
  
### Integration with PokemonGoMap

```bash
python runserver.py ...args... --webhook http://localhost:[PORT] 
```