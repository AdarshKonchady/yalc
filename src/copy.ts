const ignore = require('ignore')
import * as fs from 'fs-extra'
import { join, relative } from 'path'
import {
  PackageManifest,
  getStorePackagesDir,
  values
} from '.'

const npmIncludeDefaults = [
  'package.json'
]

const npmIgnoreDefaults = [
  '.*.swp',
  '._*',
  '.DS_Store',
  '.git',
  '.hg',
  '.npmrc',
  '.lock-wscript',
  '.svn',
  '.wafpickle-*',
  'config.gypi',
  'CVS',
  'npm-debug.log',
  'node_modules'
].concat([  
  'CHANGELOG*',  
  'README*',
  'CHANGES*',
  'HISTORY*',
  'LICENSE*',
  'LICENCE*',
  'NOTICE*',  
])

const getIngoreFilesContent = (workingDir: string, hasFilesEntry: boolean): string => {
  let content: string = ''
  const ignoreFiles = {
    npm: join(workingDir, '.npmignore'),
    yarn: join(workingDir, '.yarnignore'),
    git: join(workingDir, '.gitignore'),
  }
  if (fs.existsSync(ignoreFiles.npm)) {
    content += fs.readFileSync(ignoreFiles.npm, 'utf-8') + '\n'
  }
  if (fs.existsSync(ignoreFiles.yarn)) {
    content += fs.readFileSync(ignoreFiles.yarn, 'utf-8') + '\n'
  }
  if (!content.length && !hasFilesEntry && fs.existsSync(ignoreFiles.git)) {
    content += fs.readFileSync(ignoreFiles.git, 'utf-8')
  }
  return content
}

export const copyWithIgnorePackageToStore = async (pkg: PackageManifest, options: {
  knit?: boolean
  workingDir: string
}) => {
  const { workingDir } = options

  const ignoreRule = ignore()
    .add(npmIgnoreDefaults)
    .add(values.locedPackagesFolder)
    .add(getIngoreFilesContent(workingDir, !!pkg.files))
  const ignores = (f: string, isDir: boolean) =>
    ignoreRule.ignores(f) || (isDir && ignoreRule.ignores(f + '/'))

  const includeRule = pkg.files ? ignore()
    .add(npmIncludeDefaults)
    .add(pkg.files || []) : null
  const includes = (f: string, isDir: boolean) =>
    includeRule ?
      includeRule.ignores(f) || (isDir && includeRule.ignores(f + '/'))
      : true

  const copyFromDir = options.workingDir
  const locPackageStoreDir = join(getStorePackagesDir(), pkg.name, pkg.version)
  const filesToCopied: string[] = []
  const isDirectory = (filePath: string) => fs.statSync(filePath).isDirectory()

  const copyFilter: fs.CopyFilter = (filePath) => {
    const f = relative(copyFromDir, filePath)
    if (!f) return true
    const isDir = isDirectory(filePath)
    const ignored = (ignores(f, isDir)) || !(includes(f, isDir))
    if (!ignored) {
      filesToCopied.push(f)
    }
    return !ignored
  }
  fs.removeSync(locPackageStoreDir)
  fs.copySync(copyFromDir, locPackageStoreDir, copyFilter)
  if (options.knit) {
    fs.removeSync(locPackageStoreDir)
    const ensureSymlinkSync = fs.ensureSymlinkSync as any
    filesToCopied.forEach(f => {
      const source = join(copyFromDir, f)
      if (fs.statSync(source).isDirectory()) {
        return
      }
      ensureSymlinkSync(
        source,
        join(locPackageStoreDir, f)
      )
    })
  }
}
