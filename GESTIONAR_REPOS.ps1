function Pausar {
    Write-Host ''
    Read-Host 'Presiona Enter para continuar' | Out-Null
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  GESTIONAR TUS REPOSITORIOS DE GITHUB (privado / publico)'
Write-Host '============================================================'
Write-Host ''

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '[X] No encuentro el CLI de GitHub (gh) instalado.'
    Write-Host '    Corre INSTALAR_GH.bat primero.'
    Pausar
    exit 1
}

Write-Host '--- Verificando sesion de GitHub ---'
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host '[!] No hay sesion activa. Abriendo el navegador para que inicies sesion tu mismo...'
    gh auth login --web --git-protocol https
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[X] No se pudo iniciar sesion en GitHub.'
        Pausar
        exit 1
    }
} else {
    Write-Host '[OK] Sesion de GitHub activa'
}

$repos = @()
$reload = $true

while ($true) {
    if ($reload) {
        Write-Host ''
        Write-Host '--- Consultando tus repositorios en GitHub... ---'
        # FIX: capturar la salida de "gh" puede devolver un arreglo con una
        # linea por elemento en vez de un solo texto. Convertir cada linea
        # por separado rompia el JSON (por eso salia "System.Object[]").
        # Aqui se junta todo en un solo texto antes de convertirlo.
        $jsonLines = gh repo list --limit 200 --json nameWithOwner,visibility 2>$null
        $exitCodeRepos = $LASTEXITCODE
        $jsonText = ($jsonLines -join "`n")
        if ($exitCodeRepos -ne 0 -or [string]::IsNullOrWhiteSpace($jsonText)) {
            Write-Host '[X] No pude obtener la lista de repositorios.'
            Pausar
            exit 1
        }
        $repos = @($jsonText | ConvertFrom-Json)
        if ($repos.Count -eq 0) {
            Write-Host '[X] No encontre ningun repositorio en tu cuenta de GitHub.'
            Pausar
            exit 1
        }
        $reload = $false
    }

    Clear-Host
    Write-Host ''
    Write-Host '============================================================'
    Write-Host "  TUS REPOSITORIOS ($($repos.Count) encontrados)"
    Write-Host '============================================================'
    Write-Host ''
    for ($i = 0; $i -lt $repos.Count; $i++) {
        $n = $i + 1
        Write-Host ("  {0}) {1}   -   {2}" -f $n, $repos[$i].nameWithOwner, $repos[$i].visibility)
    }
    Write-Host ''
    Write-Host '------------------------------------------------------------'
    Write-Host '  Escribe el NUMERO del repo que quieras cambiar, o:'
    Write-Host '    TODOS PRIVADO   - vuelve PRIVADOS todos los de la lista'
    Write-Host '    TODOS PUBLICO   - vuelve PUBLICOS todos los de la lista'
    Write-Host '    FIN             - salir'
    Write-Host '------------------------------------------------------------'
    $opcion = Read-Host '  >'

    if ([string]::IsNullOrWhiteSpace($opcion)) { continue }
    $opcionN = $opcion.Trim().ToUpper()

    if ($opcionN -eq 'FIN') { break }

    if ($opcionN -eq 'TODOS PRIVADO') {
        foreach ($r in $repos) {
            Write-Host "Cambiando $($r.nameWithOwner) a privado..."
            gh repo edit $r.nameWithOwner --visibility private --accept-visibility-change-consequences *> $null
        }
        Pausar
        $reload = $true
        continue
    }

    if ($opcionN -eq 'TODOS PUBLICO') {
        $confirmar = Read-Host '  Esto expone TODOS tus repos a internet. Escribe "si" para confirmar'
        if ($confirmar.Trim().ToLower() -eq 'si') {
            foreach ($r in $repos) {
                Write-Host "Cambiando $($r.nameWithOwner) a publico..."
                gh repo edit $r.nameWithOwner --visibility public --accept-visibility-change-consequences *> $null
            }
        } else {
            Write-Host '[-] Cancelado. No se cambio nada.'
        }
        Pausar
        $reload = $true
        continue
    }

    $num = 0
    if (-not [int]::TryParse($opcion.Trim(), [ref]$num) -or $num -lt 1 -or $num -gt $repos.Count) {
        Write-Host '[!] No entendi esa opcion. Usa un numero, o TODOS PRIVADO / TODOS PUBLICO / FIN.'
        Pausar
        continue
    }

    $elegido = $repos[$num - 1]
    Write-Host ''
    Write-Host "  $($elegido.nameWithOwner)  (actualmente: $($elegido.visibility))"
    $nueva = Read-Host '  Escribe PRIVADO o PUBLICO'
    switch ($nueva.Trim().ToUpper()) {
        'PRIVADO' {
            gh repo edit $elegido.nameWithOwner --visibility private --accept-visibility-change-consequences
        }
        'PUBLICO' {
            $confirmar2 = Read-Host "  Seguro que quieres exponer $($elegido.nameWithOwner) a internet? Escribe 'si'"
            if ($confirmar2.Trim().ToLower() -eq 'si') {
                gh repo edit $elegido.nameWithOwner --visibility public --accept-visibility-change-consequences
            } else {
                Write-Host '[-] Cancelado.'
            }
        }
        default {
            Write-Host '[!] Opcion no valida. Escribe PRIVADO o PUBLICO.'
        }
    }
    Pausar
    $reload = $true
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  LISTO.'
Write-Host '============================================================'
Pausar
exit 0
