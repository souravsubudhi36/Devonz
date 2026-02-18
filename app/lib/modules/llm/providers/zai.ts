import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class ZaiProvider extends BaseProvider {
  name = 'Z.ai';
  getApiKeyLink = 'https://z.ai/manage-apikey/apikey-list';
  labelForGetApiKey = 'Get Z.ai API Key';
  icon = 'i-ph:brain';

  config = {
    apiTokenKey: 'ZAI_API_KEY',
    baseUrlKey: 'ZAI_API_BASE_URL',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'glm-5',
      label: 'GLM-5',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 131072,
    },
    {
      name: 'glm-4.7',
      label: 'GLM-4.7',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 131072,
    },
    {
      name: 'glm-4.7-flash',
      label: 'GLM-4.7 Flash',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 131072,
    },
    {
      name: 'glm-4.7-flashx',
      label: 'GLM-4.7 FlashX',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 131072,
    },
    {
      name: 'glm-4.6',
      label: 'GLM-4.6',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 131072,
    },
    {
      name: 'glm-4.5',
      label: 'GLM-4.5',
      provider: 'Z.ai',
      maxTokenAllowed: 98304,
      maxCompletionTokens: 98304,
    },
    {
      name: 'glm-4.5-air',
      label: 'GLM-4.5 Air',
      provider: 'Z.ai',
      maxTokenAllowed: 98304,
      maxCompletionTokens: 98304,
    },
    {
      name: 'glm-4.5-x',
      label: 'GLM-4.5 X',
      provider: 'Z.ai',
      maxTokenAllowed: 98304,
      maxCompletionTokens: 98304,
    },
    {
      name: 'glm-4.5-airx',
      label: 'GLM-4.5 AirX',
      provider: 'Z.ai',
      maxTokenAllowed: 98304,
      maxCompletionTokens: 98304,
    },
    {
      name: 'glm-4.5-flash',
      label: 'GLM-4.5 Flash',
      provider: 'Z.ai',
      maxTokenAllowed: 98304,
      maxCompletionTokens: 98304,
    },
    {
      name: 'glm-4-32b-0414-128k',
      label: 'GLM-4 32B 128K',
      provider: 'Z.ai',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 16384,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv,
      defaultBaseUrlKey: 'ZAI_API_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || 'https://api.z.ai/api/coding/paas/v4',
      apiKey,
    });

    return openai(model);
  }
}
