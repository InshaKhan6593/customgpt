import { getToolsFromOpenAPI } from './lib/tools/openapi'
import { zodToJsonSchema } from 'zod-to-json-schema'

const pokeapi = {
  "openapi": "3.0.0",
  "paths": {
    "/pokemon/{name}": {
      "get": {
        "operationId": "get_pokemon_data",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    }
  }
}

const openMeteo = {
  "openapi": "3.0.0",
  "paths": {
    "/forecast": {
      "get": {
        "operationId": "get_weather"
      }
    }
  }
}

const tools1 = getToolsFromOpenAPI(JSON.stringify(pokeapi))
console.log("PokeAPI JSON Schema:")
console.log(JSON.stringify(zodToJsonSchema(tools1.get_pokemon_data.parameters), null, 2))

const tools2 = getToolsFromOpenAPI(JSON.stringify(openMeteo))
console.log("\nOpenMeteo JSON Schema:")
console.log(JSON.stringify(zodToJsonSchema(tools2.get_weather.parameters), null, 2))
