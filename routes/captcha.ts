/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { type Captcha } from '../data/types'
import { CaptchaModel } from '../models/captcha'

// 🔒 Funções auxiliares seguras -----------------------------

function isAllowedOperator (op: string): boolean {
  return op === '+' || op === '-' || op === '*'
}

function safeEvaluateThreeTerms (a: number, op1: string, b: number, op2: string, c: number): number {
  if (!isAllowedOperator(op1) || !isAllowedOperator(op2)) {
    throw new Error('Operador inválido')
  }

  const values: number[] = [a, b, c]
  const ops: string[] = [op1, op2]

  // Primeira etapa: resolve * antes de + e -
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*') {
      const res = values[i] * values[i + 1]
      values.splice(i, 2, res)
      ops.splice(i, 1)
      i--
    }
  }

  // Segunda etapa: resolve + e -
  let result = values[0]
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    const val = values[i + 1]
    if (op === '+') result += val
    else if (op === '-') result -= val
  }

  return result
}

// -----------------------------------------------------------

export function captchas () {
  return async (req: Request, res: Response) => {
    const captchaId = req.app.locals.captchaId++
    const operators = ['*', '+', '-']

    const firstTerm = Math.floor((Math.random() * 10) + 1)
    const secondTerm = Math.floor((Math.random() * 10) + 1)
    const thirdTerm = Math.floor((Math.random() * 10) + 1)

    const firstOperator = operators[Math.floor(Math.random() * operators.length)]
    const secondOperator = operators[Math.floor(Math.random() * operators.length)]

    const expression = `${firstTerm}${firstOperator}${secondTerm}${secondOperator}${thirdTerm}`

    // ⚙️ Avaliação segura sem usar eval()
    const answer = safeEvaluateThreeTerms(
      firstTerm,
      firstOperator,
      secondTerm,
      secondOperator,
      thirdTerm
    ).toString()

    const captcha = {
      captchaId,
      captcha: expression,
      answer
    }

    const captchaInstance = CaptchaModel.build(captcha)
    await captchaInstance.save()
    res.json(captcha)
  }
}

export const verifyCaptcha = () => (req: Request, res: Response, next: NextFunction) => {
  CaptchaModel.findOne({ where: { captchaId: req.body.captchaId } }).then((captcha: Captcha | null) => {
    if ((captcha != null) && req.body.captcha === captcha.answer) {
      next()
    } else {
      res.status(401).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
    }
  }).catch((error: Error) => {
    next(error)
  })
}
