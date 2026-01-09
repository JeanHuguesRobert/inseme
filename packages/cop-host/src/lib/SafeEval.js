/**
 * Exécute du code JavaScript de manière sécurisée dans un Web Worker.
 * Se limite à des fonctions pures prenant un paramètre JSON et renvoyant un JSON.
 *
 * @param {string} code - Le code JavaScript à exécuter (doit être le corps d'une fonction ou une expression retournant une valeur).
 * @param {any} input - Les données d'entrée (JSON-serializable).
 * @param {number} timeoutMs - Temps maximum d'exécution en millisecondes.
 * @returns {Promise<any>} - Le résultat de l'exécution (JSON-serializable).
 */
export async function safeEval(
  code,
  input = {},
  library = {},
  timeoutMs = 5000
) {
  return new Promise((resolve, reject) => {
    // On s'assure que l'input est du JSON pur
    const jsonInput = JSON.parse(JSON.stringify(input));

    // Bibliothèque Standard (StdLib) - Design by Contract & Debug
    const stdLibCode = `
      const _logs = [];
      const _pendingActions = [];
      const Inseme = {
        log: (...args) => {
          const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          _logs.push(\`[LOG] \${msg}\`);
        },
        require: (condition, message) => {
          if (!condition) throw new Error(\`[PRE-CONDITION VIOLATED] \${message}\`);
        },
        ensure: (condition, message) => {
          if (!condition) throw new Error(\`[POST-CONDITION VIOLATED] \${message}\`);
        },
        check: (condition, message) => {
          if (!condition) throw new Error(\`[ASSERTION FAILED] \${message}\`);
        },
        call: (tool, args) => {
          _pendingActions.push({ tool, args });
          _logs.push(\`[ACTION] Appel du tool: \${tool}\`);
        }
      };
      // Aliases pour la concision (Meyer Style)
      const require = Inseme.require;
      const ensure = Inseme.ensure;
      const check = Inseme.check;
      const log = Inseme.log;
      const call = Inseme.call;
    `;

    // Generate library functions string
    const libStr = Object.entries(library)
      .map(
        ([name, func]) =>
          `const ${name} = (${func.args || "input"}) => { ${func.code} };`
      )
      .join("\n");

    const workerBlob = new Blob(
      [
        `
      self.onmessage = function(e) {
        const { code, input, libStr, stdLibCode } = e.data;
        try {
          // Inject StdLib
          eval(stdLibCode);

          // Inject library
          eval(libStr);

          // On enveloppe le code pour s'assurer qu'il retourne quelque chose
          let finalCode = code.trim();
          if (!finalCode.includes('return')) {
            finalCode = 'return (' + finalCode + ')';
          }

          const fn = new Function('input', finalCode);
          const result = fn(input);
          
          // Vérification que le résultat est sérialisable en JSON
          const jsonResult = JSON.parse(JSON.stringify(result));
          self.postMessage({ 
            success: true, 
            result: jsonResult, 
            logs: _logs,
            actions: _pendingActions
          });
        } catch (error) {
          self.postMessage({ 
            success: false, 
            error: error.toString(), 
            logs: typeof _logs !== 'undefined' ? _logs : [],
            actions: typeof _pendingActions !== 'undefined' ? _pendingActions : []
          });
        }
      };
    `,
      ],
      { type: "application/javascript" }
    );

    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);

    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);

      if (e.data.success) {
        resolve({
          result: e.data.result,
          logs: e.data.logs,
          actions: e.data.actions,
        });
      } else {
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(e.message));
    };

    worker.postMessage({ code, input: jsonInput, libStr, stdLibCode });
  });
}
